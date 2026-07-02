import { createContext, useContext, useEffect, useReducer } from "react";
import type { ReactNode } from "react";
import { api } from "../api/index";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  setUser: (user: AuthUser | null) => void;
}

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize from localStorage on mount
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
        // Set default header for future requests
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
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
  };

  const logout = () => {
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

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
