/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createAuthForm } from './shared_ui.ts';

export const renderLoginView = (appContainer: HTMLElement) => {
    // "Remember me" logic is now handled by Firebase Auth's session persistence.
    // The email is no longer pre-filled from local storage.
    const extraHtmlInside = `
        <div class="flex items-center justify-between text-sm -mt-2 mb-3">
            <div class="flex items-center gap-2">
                <input type="checkbox" id="remember-me" name="remember-me" class="h-4 w-4 rounded bg-gray-200 border-gray-300 text-blue-600 focus:ring-blue-600 dark:bg-gray-700 dark:border-gray-600" checked>
                <label for="remember-me" class="text-gray-500 dark:text-gray-400 cursor-pointer">记住我</label>
            </div>
            <a href="#" data-view="forgot-password" class="text-blue-500 hover:underline dark:text-blue-400">忘记密码？</a>
        </div>
    `;
    
    appContainer.innerHTML = createAuthForm(
        '登录',
        [ { id: 'email', name: 'email', label: '邮箱', type: 'email', value: '' }, { id: 'password', name: 'password', label: '密码', type: 'password' } ],
        [{ type: 'submit', text: '登录' }],
        [ { view: 'register', text: '注册新账号' } ],
        extraHtmlInside,
        '' // Removed extraContentOutsideForm which contained the import button
    );
};

export const renderRegisterView = (appContainer: HTMLElement) => {
    appContainer.innerHTML = createAuthForm(
        '注册',
        [ 
            { id: 'email', name: 'email', label: '邮箱', type: 'email' },
            { id: 'username', name: 'username', label: '用户名', type: 'text' },
            { id: 'password', name: 'password', label: '密码', type: 'password' },
            { id: 'confirm-password', name: 'confirm-password', label: '确认密码', type: 'password' } 
        ],
        [{ type: 'submit', text: '注册' }],
        [{ view: 'login', text: '返回登录' }]
    );
};

export const renderForgotPasswordView = (appContainer: HTMLElement) => {
    appContainer.innerHTML = createAuthForm(
        '忘记密码',
        [
            { id: 'email', name: 'email', label: '邮箱', type: 'email' },
        ],
        [{ type: 'submit', text: '发送重置邮件' }],
        [{ view: 'login', text: '返回登录' }]
    );
};