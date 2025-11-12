/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- THEME MANAGEMENT ---
export const applyTheme = (theme) => {
    if (theme === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }
    localStorage.setItem('theme', theme);
};

let currentTheme = localStorage.getItem('theme') || 'light';

export const updateThemeToggleUI = () => {
    const themeToggleText = document.getElementById('theme-toggle-text');
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    if (themeToggleText && themeToggleIcon) {
        if (currentTheme === 'dark') {
            themeToggleText.textContent = '切换亮色';
            themeToggleIcon.textContent = 'light_mode';
        } else {
            themeToggleText.textContent = '切换暗色';
            themeToggleIcon.textContent = 'dark_mode';
        }
    }
};

export const toggleTheme = () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(currentTheme);
    updateThemeToggleUI();
};
