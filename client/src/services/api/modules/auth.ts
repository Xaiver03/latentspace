// ================================
// 认证服务模块
// ================================

import { apiClient } from "../index";
import { AUTH_ENDPOINTS } from "../endpoints";
import type { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse,
  ProfileUpdateForm 
} from "../types";
import type { User } from "@shared/index";

// ================================
// 认证服务类
// ================================

class AuthService {
  /**
   * 用户登录
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(AUTH_ENDPOINTS.login, credentials);
  }

  /**
   * 用户注册
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(AUTH_ENDPOINTS.register, userData);
  }

  /**
   * 用户登出
   */
  async logout(): Promise<{ message: string }> {
    return apiClient.post(AUTH_ENDPOINTS.logout);
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>(AUTH_ENDPOINTS.profile);
  }

  /**
   * 更新用户资料
   */
  async updateProfile(data: ProfileUpdateForm): Promise<User> {
    return apiClient.put<User>(AUTH_ENDPOINTS.profile, data);
  }

  /**
   * 检查认证状态
   */
  async checkAuth(): Promise<{ isAuthenticated: boolean; user?: User }> {
    try {
      const user = await this.getCurrentUser();
      return { isAuthenticated: true, user };
    } catch (error) {
      return { isAuthenticated: false };
    }
  }

  /**
   * 上传头像
   */
  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    return apiClient.upload('/api/users/avatar', file);
  }

  /**
   * 修改密码
   */
  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ message: string }> {
    return apiClient.post('/api/users/change-password', data);
  }

  /**
   * 重置密码请求
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return apiClient.post('/api/auth/reset-password', { email });
  }

  /**
   * 重置密码确认
   */
  async resetPassword(data: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ message: string }> {
    return apiClient.post('/api/auth/reset-password/confirm', data);
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    return apiClient.post('/api/auth/verify-email', { token });
  }

  /**
   * 重新发送验证邮件
   */
  async resendVerificationEmail(): Promise<{ message: string }> {
    return apiClient.post('/api/auth/resend-verification');
  }

  /**
   * 删除账户
   */
  async deleteAccount(password: string): Promise<{ message: string }> {
    return apiClient.delete('/api/users/account', { password });
  }
}

// ================================
// 导出服务实例
// ================================

export const authService = new AuthService();
export default authService;