//import * as jwtDecode from 'jwt-decode';
// import jwtDecode from 'jwt-decode'; // Correct import for jwt-decode
import {jwtDecode} from 'jwt-decode';
import { JwtPayload } from 'jwt-decode';
// Define a new interface that includes the expected properties from the JWT payload
interface MyTokenPayload extends JwtPayload {
  username?: string;
  experimentGroup?: string;
  password: string;
  gptAuth: string;
  profile: string;
  prompt: string;
  course: string;
}
import { useDebouncedCallback } from "use-debounce";
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  Fragment,
} from "react";
import SendWhiteIcon from "../icons/send-white.svg";
import BrainIcon from "../icons/brain.svg";
import RenameIcon from "../icons/rename.svg";
import ExportIcon from "../icons/share.svg";
import ReturnIcon from "../icons/return.svg";
import CopyIcon from "../icons/copy.svg";
import LoadingIcon from "../icons/three-dots.svg";
import PromptIcon from "../icons/prompt.svg";
import MaskIcon from "../icons/mask.svg";
import MaxIcon from "../icons/max.svg";
import MinIcon from "../icons/min.svg";
import ResetIcon from "../icons/reload.svg";
import BreakIcon from "../icons/break.svg";
import SettingsIcon from "../icons/chat-settings.svg";
import DeleteIcon from "../icons/clear.svg";
import PinIcon from "../icons/pin.svg";
import EditIcon from "../icons/rename.svg";
import ConfirmIcon from "../icons/confirm.svg";
import CancelIcon from "../icons/cancel.svg";
import LightIcon from "../icons/light.svg";
import DarkIcon from "../icons/dark.svg";
import AutoIcon from "../icons/auto.svg";
import BottomIcon from "../icons/bottom.svg";
import StopIcon from "../icons/pause.svg";
import RobotIcon from "../icons/robot.svg";
import {
  ChatMessage,
  SubmitKey,
  useChatStore,
  BOT_HELLO,
  createMessage,
  useAccessStore,
  Theme,
  useAppConfig,
  DEFAULT_TOPIC,
  ModelType,
} from "../store";
import {
  copyToClipboard,
  selectOrCopy,
  autoGrowTextArea,
  useMobileScreen,
} from "../utils";
import dynamic from "next/dynamic";
import { ChatControllerPool } from "../client/controller";
import { Prompt, usePromptStore } from "../store/prompt";
import Locale from "../locales";
import { IconButton } from "./button";
import styles from "./chat.module.scss";
import {
  List,
  ListItem,
  Modal,
  Selector,
  showConfirm,
  showPrompt,
  showToast,
} from "./ui-lib";
import { useNavigate } from "react-router-dom";
import {
  CHAT_PAGE_SIZE,
  LAST_INPUT_KEY,
  Path,
  REQUEST_TIMEOUT_MS,
  UNFINISHED_INPUT,
} from "../constant";
import { Avatar } from "./emoji";
import { ContextPrompts, MaskAvatar, MaskConfig } from "./mask";
import { useMaskStore } from "../store/mask";
import { ChatCommandPrefix, useChatCommand, useCommand } from "../command";
import { prettyObject } from "../utils/format";
import { ExportMessageModal } from "./exporter";
import { getClientConfig } from "../config/client";
import { useAllModels } from "../utils/hooks";
// import useQuestionIDStore from "../store/access";
const Markdown = dynamic(async () => (await import("./markdown")).Markdown, {
  loading: () => <LoadingIcon />,
});
const recordUserInteraction = async (UserID: any, ButtonName: any, UserLogTime: any, GPTMessages: any, Note: any) => {
  const response = await fetch('/api/recordInteraction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ UserID, ButtonName, UserLogTime, GPTMessages, Note }),
  })};

export function SessionConfigModel(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const maskStore = useMaskStore();
  const navigate = useNavigate();
  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Context.Edit}
        onClose={() => props.onClose()}
        actions={[
          <IconButton
            key="reset"
            icon={<ResetIcon />}
            bordered
            text={Locale.Chat.Config.Reset}
            onClick={async () => {
              if (await showConfirm(Locale.Memory.ResetConfirm)) {
                chatStore.updateCurrentSession(
                  (session) => (session.memoryPrompt = ""),
                );
              }
            }}
          />,
          <IconButton
            key="copy"
            icon={<CopyIcon />}
            bordered
            text={Locale.Chat.Config.SaveAs}
            onClick={() => {
              navigate(Path.Masks);
              setTimeout(() => {
                maskStore.create(session.mask);
              }, 500);
            }}
          />,
        ]}
      >
        <MaskConfig
          mask={session.mask}
          updateMask={(updater) => {
            const mask = { ...session.mask };
            updater(mask);
            chatStore.updateCurrentSession((session) => (session.mask = mask));
          }}
          shouldSyncFromGlobal
          extraListItems={
            session.mask.modelConfig.sendMemory ? (
              <ListItem
                className="copyable"
                title={`${Locale.Memory.Title} (${session.lastSummarizeIndex} of ${session.messages.length})`}
                subTitle={session.memoryPrompt || Locale.Memory.EmptyContent}
              ></ListItem>
            ) : (
              <></>
            )
          }
        ></MaskConfig>
      </Modal>
    </div>
  );
}
function PromptToast(props: {
  showToast?: boolean;
  showModal?: boolean;
  setShowModal: (_: boolean) => void;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const context = session.mask.context;
  return (
    <div className={styles["prompt-toast"]} key="prompt-toast">
     
      {props.showModal && (
        <SessionConfigModel onClose={() => props.setShowModal(false)} />
      )}
    </div>
  );
}
function useSubmitHandler() {
  const config = useAppConfig();
  const submitKey = config.submitKey;
  const isComposing = useRef(false);
  useEffect(() => {
    const onCompositionStart = () => {
      isComposing.current = true;
    };
    const onCompositionEnd = () => {
      isComposing.current = false;
    };
    window.addEventListener("compositionstart", onCompositionStart);
    window.addEventListener("compositionend", onCompositionEnd);
    return () => {
      window.removeEventListener("compositionstart", onCompositionStart);
      window.removeEventListener("compositionend", onCompositionEnd);
    };
  }, []);
  const shouldSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return false;
    if (e.key === "Enter" && (e.nativeEvent.isComposing || isComposing.current))
      return false;
    return (
      (config.submitKey === SubmitKey.AltEnter && e.altKey) ||
      (config.submitKey === SubmitKey.CtrlEnter && e.ctrlKey) ||
      (config.submitKey === SubmitKey.ShiftEnter && e.shiftKey) ||
      (config.submitKey === SubmitKey.MetaEnter && e.metaKey) ||
      (config.submitKey === SubmitKey.Enter &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey)
    );
  };
  return {
    submitKey,
    shouldSubmit,
  };
}
export type RenderPompt = Pick<Prompt, "title" | "content">;
export function PromptHints(props: {
  prompts: RenderPompt[];
  onPromptSelect: (prompt: RenderPompt) => void;
}) {
  const noPrompts = props.prompts.length === 0;
  const [selectIndex, setSelectIndex] = useState(0);
  const selectedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setSelectIndex(0);
  }, [props.prompts.length]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (noPrompts || e.metaKey || e.altKey || e.ctrlKey) {
        return;
      }
      // arrow up / down to select prompt
      const changeIndex = (delta: number) => {
        e.stopPropagation();
        e.preventDefault();
        const nextIndex = Math.max(
          0,
          Math.min(props.prompts.length - 1, selectIndex + delta),
        );
        setSelectIndex(nextIndex);
        selectedRef.current?.scrollIntoView({
          block: "center",
        });
      };
      if (e.key === "ArrowUp") {
        changeIndex(1);
      } else if (e.key === "ArrowDown") {
        changeIndex(-1);
      } else if (e.key === "Enter") {
        const selectedPrompt = props.prompts.at(selectIndex);
        if (selectedPrompt) {
          props.onPromptSelect(selectedPrompt);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prompts.length, selectIndex]);
  if (noPrompts) return null;
  return (
    <div className={styles["prompt-hints"]}>
      {props.prompts.map((prompt, i) => (
        <div
          ref={i === selectIndex ? selectedRef : null}
          className={
            styles["prompt-hint"] +
            ` ${i === selectIndex ? styles["prompt-hint-selected"] : ""}`
          }
          key={prompt.title + i.toString()}
          onClick={() => props.onPromptSelect(prompt)}
          onMouseEnter={() => setSelectIndex(i)}
        >
          <div className={styles["hint-title"]}>{prompt.title}</div>
          <div className={styles["hint-content"]}>{prompt.content}</div>
        </div>
      ))}
    </div>
  );
}
function ClearContextDivider() {
  const chatStore = useChatStore();
  return (
    <div
      className={styles["clear-context"]}
      onClick={() =>
        chatStore.updateCurrentSession(
          (session) => (session.clearContextIndex = undefined),
        )
      }
    >
      <div className={styles["clear-context-tips"]}>{Locale.Context.Clear}</div>
      <div className={styles["clear-context-revert-btn"]}>
        {Locale.Context.Revert}
      </div>
    </div>
  );
}
function ChatAction(props: {
  text: string;
  icon: JSX.Element;
  onClick: () => void;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState({
    full: 16,
    icon: 16,
  });
  function updateWidth() {
    if (!iconRef.current || !textRef.current) return;
    const getWidth = (dom: HTMLDivElement) => dom.getBoundingClientRect().width;
    const textWidth = getWidth(textRef.current);
    const iconWidth = getWidth(iconRef.current);
    setWidth({
      full: textWidth + iconWidth,
      icon: iconWidth,
    });
  }
  return (
    <div
      className={`${styles["chat-input-action"]} clickable`}
      onClick={() => {
        props.onClick();
        setTimeout(updateWidth, 1);
      }}
      onMouseEnter={updateWidth}
      onTouchStart={updateWidth}
      style={
        {
          "--icon-width": `${width.icon}px`,
          "--full-width": `${width.full}px`,
        } as React.CSSProperties
      }
    >
      <div ref={iconRef} className={styles["icon"]}>
        {props.icon}
      </div>
      <div className={styles["text"]} ref={textRef}>
        {props.text}
      </div>
    </div>
  );
}
function useScrollToBottom() {
  // for auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  function scrollDomToBottom() {
    const dom = scrollRef.current;
    if (dom) {
      requestAnimationFrame(() => {
        setAutoScroll(true);
        dom.scrollTo(0, dom.scrollHeight);
      });
    }
  }
  // auto scroll
  useEffect(() => {
    if (autoScroll) {
      scrollDomToBottom();
    }
  });
  return {
    scrollRef,
    autoScroll,
    setAutoScroll,
    scrollDomToBottom,
  };
}
export function ChatActions(props: {
  showPromptModal: () => void;
  scrollToBottom: () => void;
  showPromptHints: () => void;
  hitBottom: boolean;
}) {
  const config = useAppConfig();
  const navigate = useNavigate();
  const chatStore = useChatStore();
  // switch themes
  const theme = config.theme;
  function nextTheme() {
    const themes = [Theme.Auto, Theme.Light, Theme.Dark];
    const themeIndex = themes.indexOf(theme);
    const nextIndex = (themeIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    config.update((config) => (config.theme = nextTheme));
  }
  // stop all responses
  const couldStop = ChatControllerPool.hasPending();
  const stopAll = () => ChatControllerPool.stopAll();
  // switch model
  const currentModel = chatStore.currentSession().mask.modelConfig.model;
  const allModels = useAllModels();
  const models = useMemo(
    () => allModels.filter((m) => m.available),
    [allModels],
  );
  const [showModelSelector, setShowModelSelector] = useState(false);
  useEffect(() => {
    // if current model is not available
    // switch to first available model
    const isUnavaliableModel = !models.some((m) => m.name === currentModel);
    if (isUnavaliableModel && models.length > 0) {
      const nextModel = models[0].name as ModelType;
      chatStore.updateCurrentSession(
        (session) => (session.mask.modelConfig.model = nextModel),
      );
      showToast(nextModel);
    }
  }, [chatStore, currentModel, models]);
  return (
    <div className={styles["chat-input-actions"]}>
      {/* No actions here */}
    </div>
  );
}
export function EditMessageModal(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const [messages, setMessages] = useState(session.messages.slice());
  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Chat.EditMessage.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            text={Locale.UI.Cancel}
            icon={<CancelIcon />}
            key="cancel"
            onClick={() => {
              props.onClose();
            }}
          />,
          <IconButton
            type="primary"
            text={Locale.UI.Confirm}
            icon={<ConfirmIcon />}
            key="ok"
            onClick={() => {
              chatStore.updateCurrentSession(
                (session) => (session.messages = messages),
              );
              props.onClose();
            }}
          />,
        ]}
      >
        <List>
          <ListItem
            title={Locale.Chat.EditMessage.Topic.Title}
            subTitle={Locale.Chat.EditMessage.Topic.SubTitle}
          >
            <input
              type="text"
              value={session.topic}
              onInput={(e) =>
                chatStore.updateCurrentSession(
                  (session) => (session.topic = e.currentTarget.value),
                )
              }
            ></input>
          </ListItem>
        </List>
        <ContextPrompts
          context={messages}
          updateContext={(updater) => {
            const newMessages = messages.slice();
            updater(newMessages);
            setMessages(newMessages);
          }}
        />
      </Modal>
    </div>
  );
}
function _Chat() {
  type RenderMessage = ChatMessage & { preview?: boolean };
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const config = useAppConfig();
  const fontSize = config.fontSize;
  const [showExport, setShowExport] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [userInput, setUserInput] = useState("");
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  // Effect to extract query from URL and submit automatically
  const [isLoading, setIsLoading] = useState(false);
  const { submitKey, shouldSubmit } = useSubmitHandler();
  const { scrollRef, setAutoScroll, scrollDomToBottom } = useScrollToBottom();
  const [hitBottom, setHitBottom] = useState(true);
  // const { addQuestionID, hasQuestionID, questionIDs } = useQuestionIDStore();
  const isMobileScreen = useMobileScreen();
  const navigate = useNavigate();
  // prompt hints
  const promptStore = usePromptStore();

  useEffect(() => {
    console.log("Session messages:", session.messages);
  }, [session.messages]);
  const [promptHints, setPromptHints] = useState<RenderPompt[]>([]);
  const onSearch = useDebouncedCallback(
    (text: string) => {
      const matchedPrompts = promptStore.search(text);
      setPromptHints(matchedPrompts);
    },
    100,
    { leading: true, trailing: true },
  );
  // auto grow input
  const [inputRows, setInputRows] = useState(2);
  const [questionIDs, setQuestionIDs] = useState(new Set());

  // 在组件加载时从localStorage中读取QuestionIDs
  useEffect(() => {
    const storedIDs = localStorage.getItem('questionIDs');
    if (storedIDs) {
      setQuestionIDs(new Set(JSON.parse(storedIDs)));
    }
  }, []);
  const measure = useDebouncedCallback(
    () => {
      const rows = inputRef.current ? autoGrowTextArea(inputRef.current) : 1;
      const inputRows = Math.min(
        20,
        Math.max(2 + Number(!isMobileScreen), rows),
      );
      setInputRows(inputRows);
    },
    100,
    {
      leading: true,
      trailing: true,
    },
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateAccessStore = useAccessStore((state) => state.update);
  const accessStore2 = useAccessStore();
  const username = accessStore2.accessCode;
  const [extractedUsername, setExtractedUsername] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      const decodedToken = jwtDecode<MyTokenPayload>(token);
      if (decodedToken.gptAuth) {
        updateAccessStore((state) => {
          return { ...state, accessCode: decodedToken.gptAuth };
        });
      if (decodedToken.profile){
        chatStore.updateCurrentSession(session => {
          const updatedMask = { ...session.mask }; // Copy the current mask
          updatedMask.context[0].content = decodedToken.prompt; // Modify the context by adding a new item
          updatedMask.context[1].content = decodedToken.profile; // Modify the context by adding a new item
          updatedMask.context[2].content = decodedToken.course; // Modify the context by adding a new item
          session.mask = updatedMask; // Set the modified mask back to the session
          console.log("now the context is", session.mask.context[0].content);
      });
      }
      if (decodedToken.username) {
            setExtractedUsername(decodedToken.username);
      }
      console.log('Extracted Username:', decodedToken.username);
      console.log('Extracted Experiment Group:', decodedToken.experimentGroup);
      console.log('Extracted pwd:', decodedToken.password);
      }
    }
    console.log('Extracted Username (extractedUsername state1):', extractedUsername);
  }, [updateAccessStore,extractedUsername]);
  const [botResponseCount, setBotResponseCount] = useState(0);
  useEffect(measure, [userInput]);
  // chat commands shortcuts
  const [hasRecordedInteraction, setHasRecordedInteraction] = useState(false);
  const hasRecordedInteractionRef = useRef(hasRecordedInteraction);
  // const [hasSentEvent, setHasSentEvent] = useState(false);
  const hasSentEventRef = useRef(false);
  useEffect(() => {
  const lastMessage = session.messages[session.messages.length - 1];

  if (lastMessage && lastMessage.role === 'assistant' && extractedUsername && !lastMessage.streaming && lastMessage.content.trim() !== '') {
    // 获取用户的最后一个问题
    hasSentEventRef.current = true;
    const userMessages = session.messages.filter(message => message.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    const userQuestion = lastUserMessage ? lastUserMessage.content : 'Unknown';
    const userMessageTime = lastUserMessage ? lastUserMessage.date: 'Unknown';

    // 第一步：获取UserID
    const fetchUserID = async () => {
      const response = await fetch('/api/recordInteraction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fetchUserID',
          username: extractedUsername,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch UserID');
      }

      return response.json();
    };

    // 第二步：使用获取到的UserID发送交互数据
    fetchUserID().then(data => {
      const { UserID } = data;
      const params2 = new URLSearchParams(window.location.search);
      const questionid2 = params2.get("QuestionID");
      const dataToSend: {
        action: string;
        UserID: any; // 考虑使用具体的类型而不是 any
        ButtonName: string;
        UserLogTime: string;
        GPTMessages: string;
        Note: string;
        QuestionID?: number; // 可选的 QuestionID
    } ={
        action: 'insertInteraction',
        UserID: UserID,
        ButtonName: "Bot Response",
        UserLogTime: new Date().toISOString(),
        GPTMessages: `Question: ${userQuestion}, Response: ${lastMessage.content}`,
        Note: `Respond to user at ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
      };
      if (questionid2) {
        dataToSend['QuestionID'] = parseInt(questionid2,10);
      }
      const interactionKey = `${dataToSend.UserID}-${dataToSend.GPTMessages}`;
      const recordedInteractions = JSON.parse(localStorage.getItem('recordedInteractions') || '[]');
      if (!recordedInteractions.includes(interactionKey)) {
        fetch('/api/recordInteraction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSend),
        })
        .then(response => {
          if (response.ok) {
            // Add to local storage to avoid future duplicates
            recordedInteractions.push(interactionKey);
            localStorage.setItem('recordedInteractions', JSON.stringify(recordedInteractions));
            console.log('Interaction recorded:', dataToSend);
          } else {
            throw new Error('Failed to record interaction');
          }
          // hasSentEventRef.current = false;
        })
        .catch(error => console.error('Error:', error));
      } else {
        console.log('Duplicate interaction, not recording again');
      }
    });}
}, [session.messages,extractedUsername]);
  const chatCommands = useChatCommand({
    new: () => chatStore.newSession(),
    newm: () => navigate(Path.NewChat),
    prev: () => chatStore.nextSession(-1),
    next: () => chatStore.nextSession(1),
    clear: () =>
      chatStore.updateCurrentSession(
        (session) => (session.clearContextIndex = session.messages.length),
      ),
    del: () => chatStore.deleteSession(chatStore.currentSessionIndex),
  });
  // only search prompts when user input is short
  const SEARCH_TEXT_LIMIT = 30;
  const onInput = (text: string) => {
    setUserInput(text);
    const n = text.trim().length;
    // clear search results
    if (n === 0) {
      setPromptHints([]);
    } else if (text.startsWith(ChatCommandPrefix)) {
      setPromptHints(chatCommands.search(text));
    } else if (!config.disablePromptHint && n < SEARCH_TEXT_LIMIT) {
      // check if need to trigger auto completion
      if (text.startsWith("/")) {
        let searchText = text.slice(1);
        onSearch(searchText);
      }
    }
  };
  const accessStore1 = useAccessStore();
  const userId = accessStore1.accessCode;
  const accessStore3 = useAccessStore();
  const userAccess = accessStore3.accessCode;
  const doSubmit = async (userInput: string, questionId?: number) => {
    if (userInput.trim() === "") return;
    // Fetch UserID based on the username
    const userResponse = await fetch('/api/recordInteraction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'fetchUserID',
        username: extractedUsername,
      }),
    });
   
    if (!userResponse.ok) {
      throw new Error('Failed to fetch user ID');
    }
    const { UserID } = await userResponse.json();
    const params1 = new URLSearchParams(window.location.search);
    const questionid1 = params1.get("QuestionID");
    const interactionData: {
      action: string;
      UserID: any; // 考虑使用具体的类型而不是 any
      ButtonName: string;
      UserLogTime: Date;
      GPTMessages: string;
      Note: string;
      QuestionID?: number; // 可选的 QuestionID
  } ={
      action: 'insertInteraction',
      UserID: UserID,
      ButtonName: "User Input",
      UserLogTime: new Date(),
      GPTMessages: userInput,
      Note: `user sent a message at ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`
    }
    if (questionid1) {
      interactionData['QuestionID'] = parseInt(questionid1,10);
    }
    const response = await fetch('/api/recordInteraction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(interactionData),
    });
    if (!response.ok) {
      throw new Error('Failed to insert user msg');
    }
    const matchCommand = chatCommands.match(userInput);
    if (matchCommand.matched) {
      setUserInput("");
      setPromptHints([]);
      matchCommand.invoke();
      return;
    }
    setIsLoading(true);
    chatStore.onUserInput(userInput).then(() => {
      setIsLoading(false);
  
      // 获取当前会话
      const session = chatStore.currentSession();
  
      // 获取会话中的最后一条消息，假设它是机器人的回答
      const lastMessage = session.messages[session.messages.length - 1];
      if (lastMessage) {
        const robotResponse = lastMessage; // 提取机器人的回答
  
        // 发送机器人的回答到 Google Analytics
        // window.gtag('event', 'robot response', {
        //   'event_category': 'Chat',
        //   'event_label': 'Robot Response',
        //   'response': robotResponse
        // });
      }
    });

  localStorage.setItem(LAST_INPUT_KEY, userInput);
  setUserInput("");
  setPromptHints([]);
  if (!isMobileScreen) inputRef.current?.focus();
  setAutoScroll(true);
  
  function splitText1(text: string, partLength: number): string[] {
    let parts: string[] = [];
    let index = 0;
      
    // 循环直到文本结束
    while(index < text.length) {
      parts.push(text.substring(index, Math.min(index + partLength, text.length)));
      index += partLength;
    }
    // 确保结果数组有四个元素，不足部分填充为空字符串
    while(parts.length < 4) {
          parts.push("empty");
    }
      
    return parts.slice(0, 4); // 只返回前四个部分
  }
  const timestamp = new Date();
  const record = `${userInput}`;
  const user_name = `${userId}`;
  const time_shot = `${timestamp}`;
  const userrec = `${userAccess}`;
  const [rec1, rec2, rec3, rec4] = splitText1(record, 75);
   // window.gtag('event', 'send_message', { 'time_shot':time_shot, 'user_name':user_name, 'rec1':rec1, 'rec2':rec2, 'rec3':rec3, 'rec4':rec4});
  // window.gtag('event', 'user_access', {  'userrec': userrec });
  // setHasSentEvent(false);
};
  // 自动处理URL中的question参数
const [questionContent, setQuestionContent] = useState('');
// const [firstQuestionIDReceived, setFirstQuestionIDReceived] = useState(false);
const fetchQuestion = async (questionId: string) => {
  try {
    const questionIdInt = parseInt(questionId, 10);  // 将字符串转换为整数
    if (isNaN(questionIdInt)) {
      console.error("Invalid QuestionID:", questionId);
      return;
    }
    const response = await fetch('/api/fetchQuestion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'fetchQuestion', questionId: questionIdInt })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch question');
    }

    const data = await response.json();
    if (data.success) {
      console.log("Fetched question content:", data.question.Content);
      setQuestionContent(data.question.Content);  // 更新状态
      return data.question.Content;
    } else {
      console.error('Failed to fetch question:', data.message);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
};
const [firstQuestionIDReceived, setFirstQuestionIDReceived] = useState(false); 
const firstQuestionIDReceivedRef = useRef(false);
// const [questionIDs, setQuestionIDs] = useState(new Set());
const [firstQuestionID, setFirstQuestionID] = useState(null); // Store the very first QuestionID
const [seenQuestionIDs, setSeenQuestionIDs] = useState(new Set()); // Set to track seen QuestionIDs
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const questionid = params.get("QuestionID");
  console.log("Received question from URL:", questionid);
  // if (questionid) {
  //   fetchQuestion(questionid).then(content => {
  //     // 可以在这里使用获取到的问题内容
  //     console.log('Fetched Content:', content);
  //   });
  // }
  if (questionid &&!questionIDs.has(questionid) && !autoSubmitted && extractedUsername) { 
    const addQuestionID = (id:number) => {
      if (id !== null && !questionIDs.has(id)) {
        const newQuestionIDs = new Set(questionIDs.add(id));
        setQuestionIDs(newQuestionIDs);
        localStorage.setItem('questionIDs', JSON.stringify(Array.from(newQuestionIDs)));
  
        // Check if this is the second non-null questionID
        if (newQuestionIDs.size >= 2) {
          chatStore.updateCurrentSession(session => {
            // session.mask.context = [];
            session.messages = [];
            console.log("All messages have been cleared due to new QuestionID.");
          });
        }
      }
    };
    // if (questionid&& questionid !== 'null') {
    //   // const isNewQuestionID = !seenQuestionIDs.has(questionid);
    //   if (!hasQuestionID(questionid)) {
    //     // Add new QuestionID to the set
    //     addQuestionID(questionid);
    //     // setSeenQuestionIDs(new Set(seenQuestionIDs.add(questionid)));
    //     if (questionIDs.size > 1) {
    //       chatStore.updateCurrentSession(session => {
    //         session.mask.context = [];
    //         session.messages = [];
    //         console.log("All messages have been cleared due to new QuestionID.");
    //       });
    //     }
    //   }
    // }
      // if (seenQuestionIDs.size >= 1) {
      //   // Clear messages if more than one unique QuestionID has been received
      //   chatStore.updateCurrentSession(session => {
      //     // Clear the context and possibly other session-specific data
      //     session.mask.context = [];
      //     session.messages = [];
      //     console.log("Session context has been cleared.");
      // });
      // }}
      fetchQuestion(questionid).then(Content => {
        // 可以在这里使用获取到的问题内容
        const questionIdInt = parseInt(questionid, 10);
        addQuestionID(questionIdInt);
        // console.log(firstQuestionIDReceived);
      //   if (!firstQuestionIDReceivedRef.current) {
      //   // firstQuestionIDReceivedRef.current = true; // 更新 ref
      //   // setFirstQuestionIDReceived(true); // 设置为true，表明已接收到首个QuestionID
      //   console.log("First time QuestionID received.");
      // } else{
      //   chatStore.updateCurrentSession(session => {
      //     // 设置messages为空数组，从而删除所有消息
      //     session.messages = [];
      //     console.log("All messages have been deleted.");
      //   });}
        // chatStore.newSession();
        // if (!firstQuestionIDReceived) {
        //   setFirstQuestionIDReceived(true);
        //   console.log("now is:",firstQuestionIDReceived);
        // } else {
        //   chatStore.deleteSession(chatStore.currentSessionIndex); 
        // }
        // doSubmit(decodeURIComponent(Content),questionIdInt);
        doSubmit(Content,questionIdInt);
        setAutoSubmitted(true);
        console.log('Fetched Content:', Content);
      });
  }
}, [autoSubmitted, extractedUsername])
// useEffect(() => {
//   const params = new URLSearchParams(window.location.search);
//   const question = params.get("question");
//   // const token = params.get('token');

//   // if (token) {
//   //   const decoded = jwtDecode(token);
//   //   if (decoded && decoded.username) {
//   //     setExtractedUsername(decoded.username);
//   //   }
//   // }

//   if (question && !autoSubmitted) {
//     doSubmit(decodeURIComponent(question));
//     setAutoSubmitted(true);
//   }
// }, [autoSubmitted]);
  const onPromptSelect = (prompt: RenderPompt) => {
    setTimeout(() => {
      setPromptHints([]);
      const matchedChatCommand = chatCommands.match(prompt.content);
      if (matchedChatCommand.matched) {
        // if user is selecting a chat command, just trigger it
        matchedChatCommand.invoke();
        setUserInput("");
      } else {
        // or fill the prompt
        setUserInput(prompt.content);
      }
      inputRef.current?.focus();
    }, 30);
  };
  // stop response
  const onUserStop = (messageId: string) => {
    ChatControllerPool.stop(session.id, messageId);
  };
  useEffect(() => {
    chatStore.updateCurrentSession((session) => {
      const stopTiming = Date.now() - REQUEST_TIMEOUT_MS;
      session.messages.forEach((m) => {
        // check if should stop all stale messages
        if (m.isError || new Date(m.date).getTime() < stopTiming) {
          if (m.streaming) {
            m.streaming = false;
          }
          if (m.content.length === 0) {
            m.isError = true;
            m.content = prettyObject({
              error: true,
              message: "empty response",
            });
          }
        }
      });
      // auto sync mask config from global config
      if (session.mask.syncGlobalConfig) {
        console.log("[Mask] syncing from global, name = ", session.mask.name);
        session.mask.modelConfig = { ...config.modelConfig };
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // check if should send message
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // if ArrowUp and no userInput, fill with last input
    if (
      e.key === "ArrowUp" &&
      userInput.length <= 0 &&
      !(e.metaKey || e.altKey || e.ctrlKey)
    ) {
      setUserInput(localStorage.getItem(LAST_INPUT_KEY) ?? "");
      e.preventDefault();
      return;
    }
    if (shouldSubmit(e) && promptHints.length === 0) {
      doSubmit(userInput);
      e.preventDefault();
    }
  };
  const onRightClick = (e: any, message: ChatMessage) => {
    // copy to clipboard
    if (selectOrCopy(e.currentTarget, message.content)) {
      if (userInput.length === 0) {
        setUserInput(message.content);
      }
      e.preventDefault();
    }
  };
  const deleteMessage = (msgId?: string) => {
    chatStore.updateCurrentSession(
      (session) =>
        (session.messages = session.messages.filter((m) => m.id !== msgId)),
    );
  };
  const onDelete = (msgId: string) => {
    deleteMessage(msgId);
  };
  const onResend = (message: ChatMessage) => {
    // when it is resending a message
    // 1. for a user's message, find the next bot response
    // 2. for a bot's message, find the last user's input
    // 3. delete original user input and bot's message
    // 4. resend the user's input
    const resendingIndex = session.messages.findIndex(
      (m) => m.id === message.id,
    );
    if (resendingIndex < 0 || resendingIndex >= session.messages.length) {
      console.error("[Chat] failed to find resending message", message);
      return;
    }
    let userMessage: ChatMessage | undefined;
    let botMessage: ChatMessage | undefined;
    if (message.role === "assistant") {
      // if it is resending a bot's message, find the user input for it
      botMessage = message;
      for (let i = resendingIndex; i >= 0; i -= 1) {
        if (session.messages[i].role === "user") {
          userMessage = session.messages[i];
          break;
        }
      }
    } else if (message.role === "user") {
      // if it is resending a user's input, find the bot's response
      userMessage = message;
      for (let i = resendingIndex; i < session.messages.length; i += 1) {
        if (session.messages[i].role === "assistant") {
          botMessage = session.messages[i];
          break;
        }
      }
    }
    if (userMessage === undefined) {
      console.error("[Chat] failed to resend", message);
      return;
    }
    // delete the original messages
    deleteMessage(userMessage.id);
    deleteMessage(botMessage?.id);
    // resend the message
    setIsLoading(true);
    chatStore.onUserInput(userMessage.content).then(() => setIsLoading(false));
    inputRef.current?.focus();
  };
  const onPinMessage = (message: ChatMessage) => {
    chatStore.updateCurrentSession((session) =>
      session.mask.context.push(message),
    );
    showToast(Locale.Chat.Actions.PinToastContent, {
      text: Locale.Chat.Actions.PinToastAction,
      onClick: () => {
        setShowPromptModal(true);
      },
    });
  };
  const context: RenderMessage[] = useMemo(() => {
    return session.mask.hideContext ? [] : session.mask.context.slice();
  }, [session.mask.context, session.mask.hideContext]);
  const accessStore = useAccessStore();
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      const decodedToken1 = jwtDecode<MyTokenPayload>(token);
      if (decodedToken1.gptAuth) {
        accessStore.update((access) => {
          access.openaiApiKey = access.openaiApiKey;
          access.accessCode = decodedToken1.gptAuth;
        });
      }
     }
    }, []);
  if (
    context.length === 0 &&
    session.messages.at(0)?.content !== BOT_HELLO.content
  ) {
    const copiedHello = Object.assign({}, BOT_HELLO);
    if (!accessStore.isAuthorized()) {
      copiedHello.content = Locale.Error.Unauthorized;
    }
    context.push(copiedHello);
  }
  // preview messages
  const renderMessages = useMemo(() => {
    return context
      .concat(session.messages as RenderMessage[])
      .concat(
        isLoading
          ? [
              {
                ...createMessage({
                  role: "assistant",
                  content: "……",
                }),
                preview: true,
              },
            ]
          : [],
      )
      .concat(
        userInput.length > 0 && config.sendPreviewBubble
          ? [
              {
                ...createMessage({
                  role: "user",
                  content: userInput,
                }),
                preview: true,
              },
            ]
          : [],
      );
  }, [
    config.sendPreviewBubble,
    context,
    isLoading,
    session.messages,
    userInput,
  ]);
  const [msgRenderIndex, _setMsgRenderIndex] = useState(
    Math.max(0, renderMessages.length - CHAT_PAGE_SIZE),
  );
  function setMsgRenderIndex(newIndex: number) {
    newIndex = Math.min(renderMessages.length - CHAT_PAGE_SIZE, newIndex);
    newIndex = Math.max(0, newIndex);
    _setMsgRenderIndex(newIndex);
  }
  const messages = useMemo(() => {
    const endRenderIndex = Math.min(
      msgRenderIndex + 3 * CHAT_PAGE_SIZE,
      renderMessages.length,
    );
    return renderMessages.slice(msgRenderIndex, endRenderIndex);
  }, [msgRenderIndex, renderMessages]);
  const onChatBodyScroll = (e: HTMLElement) => {
    const bottomHeight = e.scrollTop + e.clientHeight;
    const edgeThreshold = e.clientHeight;
    const isTouchTopEdge = e.scrollTop <= edgeThreshold;
    const isTouchBottomEdge = bottomHeight >= e.scrollHeight - edgeThreshold;
    const isHitBottom =
      bottomHeight >= e.scrollHeight - (isMobileScreen ? 4 : 10);
    const prevPageMsgIndex = msgRenderIndex - CHAT_PAGE_SIZE;
    const nextPageMsgIndex = msgRenderIndex + CHAT_PAGE_SIZE;
    if (isTouchTopEdge && !isTouchBottomEdge) {
      setMsgRenderIndex(prevPageMsgIndex);
    } else if (isTouchBottomEdge) {
      setMsgRenderIndex(nextPageMsgIndex);
    }
    setHitBottom(isHitBottom);
    setAutoScroll(isHitBottom);
  };
  function scrollToBottom() {
    setMsgRenderIndex(renderMessages.length - CHAT_PAGE_SIZE);
    scrollDomToBottom();
  }
  // clear context index = context length + index in messages
  const clearContextIndex =
    (session.clearContextIndex ?? -1) >= 0
      ? session.clearContextIndex! + context.length - msgRenderIndex
      : -1;
  const [showPromptModal, setShowPromptModal] = useState(false);
  const clientConfig = useMemo(() => getClientConfig(), []);
  const autoFocus = !isMobileScreen; // wont auto focus on mobile screen
  const showMaxIcon = !isMobileScreen && !clientConfig?.isApp;
  useCommand({
    fill: setUserInput,
    submit: (text) => {
      doSubmit(text);
    },
    code: (text) => {
      if (accessStore.disableFastLink) return;
      console.log("[Command] got code from url: ", text);
      showConfirm(Locale.URLCommand.Code + `code = ${text}`).then((res) => {
        if (res) {
          accessStore.update((access) => (access.accessCode = text));
        }
      });
    },
    settings: (text) => {
      if (accessStore.disableFastLink) return;
      try {
        const payload = JSON.parse(text) as {
          key?: string;
          url?: string;
        };
        console.log("[Command] got settings from url: ", payload);
        if (payload.key || payload.url) {
          showConfirm(
            Locale.URLCommand.Settings +
              `\n${JSON.stringify(payload, null, 4)}`,
          ).then((res) => {
            if (!res) return;
            if (payload.key) {
              accessStore.update(
                (access) => (access.openaiApiKey = payload.key!),
              );
            }
            if (payload.url) {
              accessStore.update((access) => (access.openaiUrl = payload.url!));
            }
          });
        }
      } catch {
        console.error("[Command] failed to get settings from url: ", text);
      }
    },
  });
  // edit / insert message modal
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  // remember unfinished input
  useEffect(() => {
    // try to load from local storage
    const key = UNFINISHED_INPUT(session.id);
    const mayBeUnfinishedInput = localStorage.getItem(key);
    if (mayBeUnfinishedInput && userInput.length === 0) {
      setUserInput(mayBeUnfinishedInput);
      localStorage.removeItem(key);
    }
    const dom = inputRef.current;
    return () => {
      localStorage.setItem(key, dom?.value ?? "");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={styles.chat} key={session.id}>
      <div className="window-header" data-tauri-drag-region>
        {isMobileScreen && (
          <div className="window-actions">
            <div className={"window-action-button"}>
              {/* No actions here */}
            </div>
          </div>
        )}
        <div className={`window-header-title ${styles["chat-body-title"]}`}>
          <div
            className={`window-header-main-title ${styles["chat-body-main-title"]}`}
            // onClickCapture={() => setIsEditingMessage(true)}
          >
            {!session.topic ? DEFAULT_TOPIC : session.topic}
          </div>
          <div className="window-header-sub-title">
            {Locale.Chat.SubTitle(session.messages.length)}
          </div>
        </div>
        <div className="window-actions">
         
          <div className="window-action-button">
             {/* No actions here */}
          </div>
 
        </div>
        <PromptToast
          showToast={!hitBottom}
          showModal={showPromptModal}
          setShowModal={setShowPromptModal}
        />
      </div>
      <div
        className={styles["chat-body"]}
        ref={scrollRef}
        onScroll={(e) => onChatBodyScroll(e.currentTarget)}
        onMouseDown={() => inputRef.current?.blur()}
        onTouchStart={() => {
          inputRef.current?.blur();
          setAutoScroll(false);
        }}
      >
        {messages.map((message, i) => {
          const isUser = message.role === "user";
          const isContext = i < context.length;
          const showActions =
            i > 0 &&
            !(message.preview || message.content.length === 0) &&
            !isContext;
          const showTyping = message.preview || message.streaming;
          const shouldShowClearContextDivider = i === clearContextIndex - 1;
          return (
            <Fragment key={message.id}>
              <div
                className={
                  isUser ? styles["chat-message-user"] : styles["chat-message"]
                }
              >
                <div className={styles["chat-message-container"]}>
                  <div className={styles["chat-message-header"]}>
                    <div className={styles["chat-message-avatar"]}>
                      <div className={styles["chat-message-edit"]}>
                        <IconButton
                          icon={<EditIcon />}
                          onClick={async () => {
                            const newMessage = await showPrompt(
                              Locale.Chat.Actions.Edit,
                              message.content,
                              10,
                            );
                            chatStore.updateCurrentSession((session) => {
                              const m = session.mask.context
                                .concat(session.messages)
                                .find((m) => m.id === message.id);
                              if (m) {
                                m.content = newMessage;
                              }
                            });
                          }}
                        ></IconButton>
                      </div>
                      {isUser ? (
                        <Avatar avatar={config.avatar} />
                      ) : (
                        <>
                          {["system"].includes(message.role) ? (
                            <Avatar avatar="2699-fe0f" />
                          ) : (
                            <MaskAvatar
                              avatar={session.mask.avatar}
                              model={
                                message.model || session.mask.modelConfig.model
                              }
                            />
                          )}
                        </>
                      )}
                    </div>
                    {showActions && (
                      <div className={styles["chat-message-actions"]}>
                        <div className={styles["chat-input-actions"]}>
                          {message.streaming ? (
                            <ChatAction
                              text={Locale.Chat.Actions.Stop}
                              icon={<StopIcon />}
                              onClick={() => onUserStop(message.id ?? i)}
                            />
                          ) : (
                            <>
                              <ChatAction
                                text={Locale.Chat.Actions.Retry}
                                icon={<ResetIcon />}
                                onClick={() => onResend(message)}
                              />
                              <ChatAction
                                text={Locale.Chat.Actions.Delete}
                                icon={<DeleteIcon />}
                                onClick={() => onDelete(message.id ?? i)}
                              />
                              <ChatAction
                                text={Locale.Chat.Actions.Pin}
                                icon={<PinIcon />}
                                onClick={() => onPinMessage(message)}
                              />
                              <ChatAction
                                text={Locale.Chat.Actions.Copy}
                                icon={<CopyIcon />}
                                onClick={() => copyToClipboard(message.content)}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {showTyping && (
                    <div className={styles["chat-message-status"]}>
                      {Locale.Chat.Typing}
                    </div>
                  )}
                  <div className={styles["chat-message-item"]}>
                    <Markdown
                      content={message.content}
                      loading={
                        (message.preview || message.streaming) &&
                        message.content.length === 0 &&
                        !isUser
                      }
                      onContextMenu={(e) => onRightClick(e, message)}
                      onDoubleClickCapture={() => {
                        if (!isMobileScreen) return;
                        setUserInput(message.content);
                      }}
                      fontSize={fontSize}
                      parentRef={scrollRef}
                      defaultShow={i >= messages.length - 6}
                    />
                  </div>
                  <div className={styles["chat-message-action-date"]}>
                    {isContext
                      ? Locale.Chat.IsContext
                      : message.date.toLocaleString()}
                  </div>
                </div>
              </div>
              {shouldShowClearContextDivider && <ClearContextDivider />}
            </Fragment>
          );
        })}
      </div>
      <div className={styles["chat-input-panel"]}>
        <PromptHints prompts={promptHints} onPromptSelect={onPromptSelect} />
        <ChatActions
          showPromptModal={() => setShowPromptModal(true)}
          scrollToBottom={scrollToBottom}
          hitBottom={hitBottom}
          showPromptHints={() => {
            // Click again to close
            if (promptHints.length > 0) {
              setPromptHints([]);
              return;
            }
            inputRef.current?.focus();
            setUserInput("/");
            onSearch("");
          }}
        />
        <div className={styles["chat-input-panel-inner"]}>
          <textarea
            ref={inputRef}
            className={styles["chat-input"]}
            placeholder={Locale.Chat.Input(submitKey)}
            onInput={(e) => onInput(e.currentTarget.value)}
            value={userInput}
            onKeyDown={onInputKeyDown}
            onFocus={scrollToBottom}
            onClick={scrollToBottom}
            rows={inputRows}
            autoFocus={autoFocus}
            style={{
              fontSize: config.fontSize,
            }}
          />
          <IconButton
            icon={<SendWhiteIcon />}
            text={Locale.Chat.Send}
            className={styles["chat-input-send"]}
            type="primary"
            onClick={() => doSubmit(userInput)}
          />
        </div>
      </div>
      {showExport && (
        <ExportMessageModal onClose={() => setShowExport(false)} />
      )}
      {isEditingMessage && (
        <EditMessageModal
          onClose={() => {
            setIsEditingMessage(false);
          }}
        />
      )}
    </div>
  );
}
export function Chat() {
  const chatStore = useChatStore();
  const sessionIndex = chatStore.currentSessionIndex;
  return <_Chat key={sessionIndex}></_Chat>;
}
