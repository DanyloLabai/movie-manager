import { useEffect, useReducer } from "react";
import type { ReactNode } from "react";
import { api } from "../api/index";
import { updateTimezone } from "../api/users.api";
import { logError } from "../utils/logError";
import { AuthContext, type AuthContextType, type AuthUser } from "./useAuth";

type AuthAction =
  | { type: "SET_USER"; payload: { user: AuthUser; token: string } }
  | { type: "LOGOUT" }
  | {
      type: "INIT_FROM_STORAGE";
      payload: { user: AuthUser | null; token: string | null };
    }
  | { type: "SET_LOADING"; payload: boolean };

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_USER":
      return {
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
      };
    case "LOGOUT":
      return {
        user: null,
        token: null,
        isLoading: false,
      };
    case "INIT_FROM_STORAGE":
      return {
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
      };
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
}

function reportTimezone() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) updateTimezone(timezone).catch(logError("AuthContext: updateTimezone"));
  } catch {
    /* empty */
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        dispatch({
          type: "INIT_FROM_STORAGE",
          payload: { user, token },
        });
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        reportTimezone();
      } catch (error) {
        console.error("Failed to parse user from storage:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        dispatch({
          type: "INIT_FROM_STORAGE",
          payload: { user: null, token: null },
        });
      }
    } else {
      dispatch({
        type: "INIT_FROM_STORAGE",
        payload: { user: null, token: null },
      });
    }
  }, []);

  const login = (token: string, user: AuthUser) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    dispatch({
      type: "SET_USER",
      payload: { user, token },
    });
    reportTimezone();
  };

  const logout = () => {
    api.post("/auth/logout").catch(logError("AuthContext: logout"));
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete api.defaults.headers.common["Authorization"];
    dispatch({ type: "LOGOUT" });
  };

  const setUser = (user: AuthUser | null) => {
    if (user && state.token) {
      localStorage.setItem("user", JSON.stringify(user));
      dispatch({
        type: "SET_USER",
        payload: { user, token: state.token },
      });
    }
  };

  const value: AuthContextType = {
    user: state.user,
    token: state.token,
    isLoading: state.isLoading,
    isAuthenticated: !!state.token && !!state.user,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
