import { BUILTIN_MASKS } from "../masks";
import { getLang, Lang } from "../locales";
import { DEFAULT_TOPIC, ChatMessage } from "./chat";
import { ModelConfig, useAppConfig } from "./config";
import { StoreKey } from "../constant";
import { nanoid } from "nanoid";
import { createPersistStore } from "../utils/store";

export type Mask = {
  id: string;
  createdAt: number;
  avatar: string;
  name: string;
  hideContext?: boolean;
  context: ChatMessage[];
  syncGlobalConfig?: boolean;
  modelConfig: ModelConfig;
  lang: Lang;
  builtin: boolean;
};

export const DEFAULT_MASK_STATE = {
  masks: {} as Record<string, Mask>,
};

export type MaskState = typeof DEFAULT_MASK_STATE;

export const DEFAULT_MASK_AVATAR = "gpt-bot";
export const createEmptyMask = () =>
  ({
    id: nanoid(),
    avatar: DEFAULT_MASK_AVATAR,
    name: DEFAULT_TOPIC,
    hideContext: true,
    context: [
      {
        id: "scorates-0",
        role: "system",
        content:
          "You are a teaching assistant chatbot that provides at most two scaffolded hints to a learner who may have difficulty in solving a practice problem. The learner has been given a practice question on the left side of the screen and you are shown on the right side. You are invoked because the Learner would like your assistance with the practical problem. The problem and the correct answer will be given to you. It is important that you DO NOT present the correct solution to the problem right away. Instead, you should provide increasingly informative hints to the learner with the purpose of helping them retrieve the correct response to the problem from memory or giving them suggestions on how to think about the problem, with the goal of providing the right amount of assistance so they can solve the problem correctly.Specifically, please use the following 3-step procedure in guiding the learner to solve the practice problem (please don’t use step 1, step 2, step 3 in your interaction with the learner):Step 1. this step has two components. Component 1: providing the first hint, the less informative of the two hints, to the learner. Do not ask the student any related questions. Component 2: Ask the learner whether she/he needs a second hint to solve the problem. Step 2:  If the learner says “No”, then ask the learner to answer the question on the left side of the screen. If the learner says “yes”, there will be two components. Component 1: give the second, more informative hint.  Do not ask the student any related questions. Component 2: ask the learner whether she or he needs you to reveal the correct/exemplary answer to the question along with an explanation. Step 3. If the learner says “No”, then ask the learner to answer the question on the left side of the screen.  If the learner says “yes”, provide the correct/exemplary answer and a detailed explanation. Herebelow the learner/user will provide the question and please follow the 3-step directions specified above to offer the first hint to the learner/user.",
        date: "",
      },
    ],
    syncGlobalConfig: true, // use global config as default
    modelConfig: { ...useAppConfig.getState().modelConfig },
    lang: getLang(),
    builtin: false,
    createdAt: Date.now(),
  }) as Mask;

export const useMaskStore = createPersistStore(
  { ...DEFAULT_MASK_STATE },

  (set, get) => ({
    create(mask?: Partial<Mask>) {
      const masks = get().masks;
      const id = nanoid();
      masks[id] = {
        ...createEmptyMask(),
        ...mask,
        id,
        builtin: false,
      };

      set(() => ({ masks }));
      get().markUpdate();

      return masks[id];
    },
    
    updateMask(id: string, updater: (mask: Mask) => void) {
      const masks = get().masks;
      const mask = masks[id];
      if (!mask) return;
      const updateMask = { ...mask };
      updater(updateMask);
      masks[id] = updateMask;
      set(() => ({ masks }));
      get().markUpdate();
    },
    delete(id: string) {
      const masks = get().masks;
      delete masks[id];
      set(() => ({ masks }));
      get().markUpdate();
    },

    get(id?: string) {
      return get().masks[id ?? 1145141919810];
    },
    getAll() {
      const userMasks = Object.values(get().masks).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      const config = useAppConfig.getState();
      if (config.hideBuiltinMasks) return userMasks;
      const buildinMasks = BUILTIN_MASKS.map(
        (m) =>
          ({
            ...m,
            modelConfig: {
              ...config.modelConfig,
              ...m.modelConfig,
            },
          }) as Mask,
      );
      return userMasks.concat(buildinMasks);
    },
    search(text: string) {
      return Object.values(get().masks);
    },
  }),
  {
    name: StoreKey.Mask,
    version: 3.1,

    migrate(state, version) {
      const newState = JSON.parse(JSON.stringify(state)) as MaskState;

      // migrate mask id to nanoid
      if (version < 3) {
        Object.values(newState.masks).forEach((m) => (m.id = nanoid()));
      }

      if (version < 3.1) {
        const updatedMasks: Record<string, Mask> = {};
        Object.values(newState.masks).forEach((m) => {
          updatedMasks[m.id] = m;
        });
        newState.masks = updatedMasks;
      }

      return newState as any;
    },
  },
);
