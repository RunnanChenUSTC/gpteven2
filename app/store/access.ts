import {
  ApiPath,
  DEFAULT_API_HOST,
  ServiceProvider,
  StoreKey,
} from "../constant";
import { getHeaders } from "../client/api";
import { getClientConfig } from "../config/client";
import { createPersistStore } from "../utils/store";
import { ensure } from "../utils/clone";

let fetchState = 0; // 0 not fetch, 1 fetching, 2 done

const DEFAULT_OPENAI_URL =
  getClientConfig()?.buildMode === "export" ? DEFAULT_API_HOST : ApiPath.OpenAI;

const DEFAULT_ACCESS_STATE = {
  accessCode: "",
  useCustomConfig: false,

  provider: ServiceProvider.OpenAI,

  // openai
  openaiUrl: DEFAULT_OPENAI_URL,
  openaiApiKey: "",

  // azure
  azureUrl: "",
  azureApiKey: "",
  azureApiVersion: "2023-08-01-preview",

  // google ai studio
  googleUrl: "",
  googleApiKey: "",
  googleApiVersion: "v1",

  // server config
  needCode: true,
  hideUserApiKey: false,
  hideBalanceQuery: false,
  disableGPT4: false,
  disableFastLink: false,
  customModels: "",
};

// // Define the initial state with a set for question IDs
// const initialState = {
//   questionIDs: new Set(),
// };

// // Define methods to manipulate the question IDs
// const storeMethods = (set, get) => ({
//   addQuestionID: (id) => {
//     const newSet = new Set(get().questionIDs);
//     newSet.add(id);
//     set({ questionIDs: newSet });
//   },
//   hasQuestionID: (id) => {
//     return get().questionIDs.has(id);
//   },
//   clearQuestionIDs: () => {
//     set({ questionIDs: new Set() });
//   }
// });

// // Create the store with persistence options
// const useQuestionIDStore = createPersistStore(
//   initialState,
//   storeMethods,
//   {
//     name: "question-id-storage", // Name of your storage item
//     getStorage: () => localStorage, // Define where to persist (e.g., localStorage)
//   }
// );

// export default useQuestionIDStore;
// const usePersistedQuestionIDs = () => {
//   const [questionIDs, setQuestionIDs] = useState(new Set());

//   useEffect(() => {
//     // Load question IDs from local storage when the component mounts
//     const storedIDs = localStorage.getItem('questionIDs');
//     if (storedIDs) {
//       setQuestionIDs(new Set(JSON.parse(storedIDs)));
//     }
//   }, []);

//   const addQuestionID = (id) => {
//     if (id !== null && !questionIDs.has(id)) {
//       const newQuestionIDs = new Set(questionIDs);
//       newQuestionIDs.add(id);
//       setQuestionIDs(newQuestionIDs);
//       localStorage.setItem('questionIDs', JSON.stringify(Array.from(newQuestionIDs)));
//     }
//   };

//   return [questionIDs, addQuestionID];
// };

// export default usePersistedQuestionIDs;

export const useAccessStore = createPersistStore(
  { ...DEFAULT_ACCESS_STATE },

  (set, get) => ({
    enabledAccessControl() {
      this.fetch();

      return get().needCode;
    },

    isValidOpenAI() {
      return ensure(get(), ["openaiApiKey"]);
    },

    isValidAzure() {
      return ensure(get(), ["azureUrl", "azureApiKey", "azureApiVersion"]);
    },

    isValidGoogle() {
      return ensure(get(), ["googleApiKey"]);
    },

    isAuthorized() {
      this.fetch();

      // has token or has code or disabled access control
      return (
        this.isValidOpenAI() ||
        this.isValidAzure() ||
        this.isValidGoogle() ||
        !this.enabledAccessControl() ||
        (this.enabledAccessControl() && ensure(get(), ["accessCode"]))
      );
    },
    fetch() {
      if (fetchState > 0 || getClientConfig()?.buildMode === "export") return;
      fetchState = 1;
      fetch("/api/config", {
        method: "post",
        body: null,
        headers: {
          ...getHeaders(),
        },
      })
        .then((res) => res.json())
        .then((res: DangerConfig) => {
          console.log("[Config] got config from server", res);
          set(() => ({ ...res }));
        })
        .catch(() => {
          console.error("[Config] failed to fetch config");
        })
        .finally(() => {
          fetchState = 2;
        });
    },
  }),
  {
    name: StoreKey.Access,
    version: 2,
    migrate(persistedState, version) {
      if (version < 2) {
        const state = persistedState as {
          token: string;
          openaiApiKey: string;
          azureApiVersion: string;
          googleApiKey: string;
        };
        state.openaiApiKey = state.token;
        state.azureApiVersion = "2023-08-01-preview";
      }

      return persistedState as any;
    },
  },
);
