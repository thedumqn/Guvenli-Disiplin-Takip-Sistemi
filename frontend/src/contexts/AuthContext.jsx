import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, setAccessToken } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await authAPI.getCSRFToken();
        
        const response = await authAPI.getMe();
        setUser(response.data.data.user);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      setError(null);
      const response = await authAPI.login(email, password);
      
      const { user: userData, accessToken } = response.data.data;
      
      if (accessToken) {
        setAccessToken(accessToken);
      }
      
      setUser(userData);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Giriş başarısız';
      setError(message);
      return { success: false, message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (err) {
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await authAPI.logoutAll();
    } catch (err) {
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword, newPasswordConfirm) => {
    try {
      await authAPI.changePassword({ currentPassword, newPassword, newPasswordConfirm });
      setAccessToken(null);
      setUser(null);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Şifre değiştirme başarısız';
      return { success: false, message };
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.data.user);
    } catch (err) {
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions?.includes(permission) || false;
  }, [user]);

  const hasRole = useCallback((...roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    logoutAll,
    changePassword,
    refreshUser,
    hasPermission,
    hasRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
