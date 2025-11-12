/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { firestore } from './shared_firebase.ts';
// FIX: Removed Firebase v9 modular imports. Switched to v8 namespaced API calls below.
import { renderSettingsDropdown, showToast } from './shared_ui.ts';

export const handleUserPermissionsFormSubmit = async (form: HTMLFormElement) => {
    const userId = form.dataset.userId;
    if (!userId) return false;

    const selectedPermissions = Array.from(form.querySelectorAll('input[name="permission"]:checked'))
                                     .map(input => (input as HTMLInputElement).value);
    
    try {
        // FIX: Use Firebase v8 namespaced firestore methods.
        const userDocRef = firestore.collection("users").doc(userId);
        await userDocRef.update({
            permissions: selectedPermissions
        });
        showToast('权限更新成功！');
        return true;
    } catch (error) {
        showToast(`权限更新失败: ${(error as Error).message}`);
        return false;
    }
};

export const handleUserSearch = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const searchTerm = input.value.trim().toLowerCase();
    document.querySelectorAll('.user-card').forEach(card => {
        const htmlCard = card as HTMLElement;
        const email = htmlCard.dataset.userEmail?.toLowerCase() || '';
        const username = htmlCard.dataset.userUsername?.toLowerCase() || '';
        const isVisible = email.includes(searchTerm) || username.includes(searchTerm);
        htmlCard.style.display = isVisible ? 'block' : 'none';
    });
};

export const attachUserManagementListener = () => {
    const userListContainer = document.getElementById('user-list-container');
    if (!userListContainer) return null;

    const features = [
        { id: 'oa-reply', title: 'OA答复' },
        { id: 'formal-quality-check', title: '形式质检' },
        { id: 'substantive-quality-check', title: '实质质检' },
        { id: 'priority-review-materials', title: '优审材料制作' }
    ];

    const usersCol = firestore.collection("users");
    const unsubscribe = usersCol.onSnapshot(snapshot => {
        const usersToManage = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Automatic Data Fix: Ensure all users have a username.
        // This handles older accounts created before the username field was added.
        // FIX: Cast `user` to `any` to resolve TypeScript type inference issues, allowing access to properties from Firestore data.
        usersToManage.forEach((user: any) => {
            if (!user.username && user.email) {
                const defaultUsername = user.email.split('@')[0];
                // Update Firestore in the background. The listener will automatically catch
                // the change and re-render the UI with the correct username.
                firestore.collection("users").doc(user.id).update({ username: defaultUsername })
                    .catch(err => console.error(`Failed to auto-update username for ${user.email}:`, err));
            }
        });

        if (usersToManage.length === 0) {
            userListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">没有用户可供管理。</p>';
            return;
        }

        // FIX: Cast `user` to `any` to resolve TypeScript type inference issue with Firestore's `doc.data()`.
        userListContainer.innerHTML = usersToManage.map((user: any) => `
            <div class="user-card bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${user.role === 'admin' ? 'bg-gray-50 dark:bg-gray-800/50' : ''}" data-user-email="${user.email}" data-user-username="${user.username || ''}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="text-xl font-semibold">${user.username || 'N/A'}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${user.email}</p>
                    </div>
                    <span class="text-sm font-medium ${user.role === 'admin' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}">(${user.role})</span>
                </div>
                <form class="user-permissions-form" data-user-id="${user.id}">
                    <div class="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        ${features.map(feature => `
                            <label class="flex items-center gap-3 ${user.role === 'admin' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}">
                                <input type="checkbox" name="permission" value="${feature.id}" class="h-5 w-5 rounded bg-gray-200 border-gray-300 text-blue-600 focus:ring-blue-600 dark:bg-gray-700 dark:border-gray-600" ${user.permissions?.includes(feature.id) ? 'checked' : ''} ${user.role === 'admin' ? 'disabled' : ''}>
                                <span class="text-gray-700 dark:text-gray-300">${feature.title}</span>
                            </label>
                        `).join('')}
                    </div>
                    <div class="mt-6 flex justify-end items-center gap-4">
                        <button type="submit" class="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${user.role === 'admin' ? 'disabled' : ''}>保存更改</button>
                    </div>
                </form>
            </div>
        `).join('');

        // Re-apply search filter after rendering if a search term exists
        const searchInput = document.getElementById('user-search-input') as HTMLInputElement;
        if (searchInput && searchInput.value) {
            handleUserSearch({ target: searchInput } as unknown as Event);
        }

    }, error => {
        showToast(`加载用户数据失败: ${(error as Error).message}`);
        console.error("Error listening for user changes:", error);
        userListContainer.innerHTML = `<p class="text-center text-red-500 dark:text-red-400">加载用户数据时出错。</p>`;
    });

    return unsubscribe;
}


export const renderUserManagementView = (appContainer: HTMLElement) => {
    appContainer.innerHTML = `
        <div id="user-management-page" class="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
             <header class="flex justify-between items-center gap-4 p-4 md:p-5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div class="flex items-center gap-4">
                    <button id="back-to-dashboard" class="bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer p-2 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white" aria-label="返回仪表盘">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 class="text-2xl font-bold">用户权限管理</h2>
                </div>
                <div class="flex items-center gap-4">
                    ${renderSettingsDropdown()}
                </div>
            </header>
            <main class="flex-grow p-5 md:p-8 overflow-y-auto">
                <div class="max-w-4xl mx-auto space-y-6">
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 flex items-center gap-4">
                        <div class="relative flex-grow">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">search</span>
                            <input type="search" id="user-search-input" placeholder="按用户名或邮箱模糊搜索..." class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm py-2 px-3 pl-10 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                        </div>
                    </div>
                    <div id="user-list-container">
                        <div class="flex items-center justify-center p-10">
                            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                            <p class="ml-4 text-gray-500 dark:text-gray-400">正在加载用户数据...</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>`;
};
