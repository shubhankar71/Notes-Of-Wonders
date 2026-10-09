// VaultNotes Client Application & API Logic — Solid Orange Enterprise Edition

class ApiService {
  constructor() {
    this.baseUrl = '/api';
    this.onUnauthorizedCallback = null;
  }

  setUnauthorizedCallback(cb) {
    this.onUnauthorizedCallback = cb;
  }

  getToken() {
    return localStorage.getItem('access_token');
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);

      if (response.status === 401) {
        if (
          this.onUnauthorizedCallback &&
          !endpoint.includes('/auth/login') &&
          !endpoint.includes('/auth/signup') &&
          !endpoint.includes('/auth/forgot-password') &&
          !endpoint.includes('/auth/reset-password')
        ) {
          this.onUnauthorizedCallback();
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Authentication credentials missing or expired.');
      }

      if (response.status === 204) {
        return null;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        throw new Error('Unable to connect to backend server. Please verify connection.');
      }
      throw err;
    }
  }

  // Auth API Methods
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async signup(email, username, password) {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
  }

  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(email, otp, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, new_password: newPassword }),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Notes API Methods
  async getNotes(search = '', tag = '', pinnedOnly = false) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (tag) params.append('tag', tag);
    if (pinnedOnly) params.append('pinned_only', 'true');

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/notes/${queryString}`);
  }

  async getTags() {
    return this.request('/notes/tags');
  }

  async createNote(noteData) {
    return this.request('/notes/', {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
  }

  async updateNote(id, noteData) {
    return this.request(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(noteData),
    });
  }

  async deleteNote(id) {
    return this.request(`/notes/${id}`, {
      method: 'DELETE',
    });
  }
}

const api = new ApiService();

// Application Controller
document.addEventListener('DOMContentLoaded', () => {
  const app = {
    user: null,
    notes: [],
    tags: [],
    searchQuery: '',
    selectedTag: '',
    pinnedOnlyFilter: false,
    editingNoteId: null,
    deletingNoteId: null,

    init() {
      this.cacheDOM();
      this.bindEvents();

      api.setUnauthorizedCallback(() => {
        this.handleUnauthorized();
      });

      this.checkAuth();
    },

    cacheDOM() {
      this.authView = document.getElementById('authView');
      this.dashboardView = document.getElementById('dashboardView');

      this.authTabsContainer = document.getElementById('authTabsContainer');
      this.loginTabBtn = document.getElementById('loginTabBtn');
      this.registerTabBtn = document.getElementById('registerTabBtn');
      this.loginForm = document.getElementById('loginForm');
      this.registerForm = document.getElementById('registerForm');
      this.authErrorMsg = document.getElementById('authErrorMsg');
      this.authSuccessMsg = document.getElementById('authSuccessMsg');

      // Forgot Password Elements
      this.forgotPasswordLink = document.getElementById('forgotPasswordLink');
      this.forgotPasswordContainer = document.getElementById('forgotPasswordContainer');
      this.requestOtpForm = document.getElementById('requestOtpForm');
      this.resetPasswordForm = document.getElementById('resetPasswordForm');
      this.forgotEmail = document.getElementById('forgotEmail');
      this.resetOtp = document.getElementById('resetOtp');
      this.resetNewPassword = document.getElementById('resetNewPassword');
      this.backToSignInBtn = document.getElementById('backToSignInBtn');
      this.requestOtpSubmitBtn = document.getElementById('requestOtpSubmitBtn');
      this.resetPasswordSubmitBtn = document.getElementById('resetPasswordSubmitBtn');

      this.userEmailDisplay = document.getElementById('userEmailDisplay');
      this.userAvatar = document.getElementById('userAvatar');
      this.logoutBtn = document.getElementById('logoutBtn');

      this.searchInput = document.getElementById('searchInput');
      this.clearSearchBtn = document.getElementById('clearSearchBtn');
      this.tagFilterSelect = document.getElementById('tagFilterSelect');
      this.pinnedFilterBtn = document.getElementById('pinnedFilterBtn');
      this.createNoteModalBtn = document.getElementById('createNoteModalBtn');

      this.notesGrid = document.getElementById('notesGrid');
      this.emptyState = document.getElementById('emptyState');
      this.totalNotesCount = document.getElementById('totalNotesCount');
      this.pinnedNotesCount = document.getElementById('pinnedNotesCount');

      this.noteModal = document.getElementById('noteModal');
      this.modalTitle = document.getElementById('modalTitle');
      this.noteForm = document.getElementById('noteForm');
      this.noteIdInput = document.getElementById('noteIdInput');
      this.noteTitleInput = document.getElementById('noteTitleInput');
      this.noteTagsInput = document.getElementById('noteTagsInput');
      this.notePinnedInput = document.getElementById('notePinnedInput');
      this.noteContentInput = document.getElementById('noteContentInput');
      this.closeModalBtn = document.getElementById('closeModalBtn');
      this.cancelModalBtn = document.getElementById('cancelModalBtn');
      this.saveNoteSubmitBtn = document.getElementById('saveNoteSubmitBtn');

      this.deleteModal = document.getElementById('deleteModal');
      this.closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
      this.cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
      this.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

      this.toastContainer = document.getElementById('toastContainer');
    },

    bindEvents() {
      this.loginTabBtn.addEventListener('click', () => this.switchAuthTab('login'));
      this.registerTabBtn.addEventListener('click', () => this.switchAuthTab('register'));

      this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
      this.registerForm.addEventListener('submit', (e) => this.handleSignup(e));
      this.logoutBtn.addEventListener('click', () => this.handleLogout());

      // Forgot Password Events
      this.forgotPasswordLink.addEventListener('click', () => this.showForgotPasswordView());
      this.backToSignInBtn.addEventListener('click', () => this.switchAuthTab('login'));
      this.requestOtpForm.addEventListener('submit', (e) => this.handleRequestOtp(e));
      this.resetPasswordForm.addEventListener('submit', (e) => this.handleResetPassword(e));

      let debounceTimeout;
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.clearSearchBtn.classList.toggle('hidden', !this.searchQuery);
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => this.fetchNotes(), 300);
      });

      this.clearSearchBtn.addEventListener('click', () => {
        this.searchInput.value = '';
        this.searchQuery = '';
        this.clearSearchBtn.classList.add('hidden');
        this.fetchNotes();
      });

      this.tagFilterSelect.addEventListener('change', (e) => {
        this.selectedTag = e.target.value;
        this.fetchNotes();
      });

      this.pinnedFilterBtn.addEventListener('click', () => {
        this.pinnedOnlyFilter = !this.pinnedOnlyFilter;
        this.pinnedFilterBtn.classList.toggle('border-orange-500', this.pinnedOnlyFilter);
        this.pinnedFilterBtn.classList.toggle('text-orange-400', this.pinnedOnlyFilter);
        this.pinnedFilterBtn.classList.toggle('bg-slate-900', this.pinnedOnlyFilter);
        this.fetchNotes();
      });

      this.createNoteModalBtn.addEventListener('click', () => this.openNoteModal());
      this.closeModalBtn.addEventListener('click', () => this.closeNoteModal());
      this.cancelModalBtn.addEventListener('click', () => this.closeNoteModal());
      this.noteForm.addEventListener('submit', (e) => this.handleSaveNote(e));

      this.closeDeleteModalBtn.addEventListener('click', () => this.closeDeleteModal());
      this.cancelDeleteBtn.addEventListener('click', () => this.closeDeleteModal());
      this.confirmDeleteBtn.addEventListener('click', () => this.handleConfirmDelete());

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeNoteModal();
          this.closeDeleteModal();
        }
      });
    },

    async checkAuth() {
      const token = localStorage.getItem('access_token');
      if (!token) {
        this.showAuthView();
        return;
      }

      try {
        const user = await api.getMe();
        this.user = user;
        this.showDashboardView();
      } catch (err) {
        this.handleUnauthorized('Session expired. Please sign in again.');
      }
    },

    handleUnauthorized(message = 'Session expired. Please sign in again.') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      this.user = null;
      this.showAuthView(message);
    },

    clearAuthBanners() {
      this.authErrorMsg.classList.add('hidden');
      this.authSuccessMsg.classList.add('hidden');
    },

    switchAuthTab(tab) {
      this.clearAuthBanners();
      this.forgotPasswordContainer.classList.add('hidden');
      this.authTabsContainer.classList.remove('hidden');

      if (tab === 'login') {
        this.loginTabBtn.className = 'w-1/2 py-2.5 text-center text-orange-500 border-b-2 border-orange-500 font-bold uppercase tracking-wider transition-colors';
        this.registerTabBtn.className = 'w-1/2 py-2.5 text-center text-slate-500 border-b-2 border-transparent hover:text-slate-300 font-bold uppercase tracking-wider transition-colors';
        this.loginForm.classList.remove('hidden');
        this.registerForm.classList.add('hidden');
      } else {
        this.registerTabBtn.className = 'w-1/2 py-2.5 text-center text-orange-500 border-b-2 border-orange-500 font-bold uppercase tracking-wider transition-colors';
        this.loginTabBtn.className = 'w-1/2 py-2.5 text-center text-slate-500 border-b-2 border-transparent hover:text-slate-300 font-bold uppercase tracking-wider transition-colors';
        this.registerForm.classList.remove('hidden');
        this.loginForm.classList.add('hidden');
      }
    },

    showForgotPasswordView() {
      this.clearAuthBanners();
      this.loginForm.classList.add('hidden');
      this.registerForm.classList.add('hidden');
      this.authTabsContainer.classList.add('hidden');
      this.forgotPasswordContainer.classList.remove('hidden');
      this.requestOtpForm.classList.remove('hidden');
      this.resetPasswordForm.classList.add('hidden');
      
      const loginEmailVal = document.getElementById('loginEmail').value.trim();
      if (loginEmailVal) {
        this.forgotEmail.value = loginEmailVal;
      }
    },

    async handleRequestOtp(e) {
      e.preventDefault();
      this.clearAuthBanners();
      const email = this.forgotEmail.value.trim();
      if (!email) return;

      this.setButtonLoading(this.requestOtpSubmitBtn, true, 'REQUESTING...');

      try {
        const res = await api.forgotPassword(email);
        this.authSuccessMsg.textContent = res.message + ' (Check terminal output for OTP code)';
        this.authSuccessMsg.classList.remove('hidden');

        // Show step 2
        this.requestOtpForm.classList.add('hidden');
        this.resetPasswordForm.classList.remove('hidden');
        this.resetOtp.focus();
      } catch (err) {
        this.authErrorMsg.textContent = err.message || 'Failed to request OTP.';
        this.authErrorMsg.classList.remove('hidden');
      } finally {
        this.setButtonLoading(this.requestOtpSubmitBtn, false, 'REQUEST RESET OTP');
      }
    },

    async handleResetPassword(e) {
      e.preventDefault();
      this.clearAuthBanners();
      const email = this.forgotEmail.value.trim();
      const otp = this.resetOtp.value.trim();
      const newPassword = this.resetNewPassword.value;

      if (!email || !otp || !newPassword) return;

      this.setButtonLoading(this.resetPasswordSubmitBtn, true, 'RESETTING...');

      try {
        const res = await api.resetPassword(email, otp, newPassword);
        this.showToast('PASSWORD RESET SUCCESSFULLY. PLEASE SIGN IN.', 'success');
        this.switchAuthTab('login');
      } catch (err) {
        this.authErrorMsg.textContent = err.message || 'Failed to reset password.';
        this.authErrorMsg.classList.remove('hidden');
      } finally {
        this.setButtonLoading(this.resetPasswordSubmitBtn, false, 'RESET PASSWORD');
      }
    },

    showAuthView(errorMessage = null) {
      this.authView.classList.remove('hidden');
      this.dashboardView.classList.add('hidden');
      this.clearAuthBanners();
      if (errorMessage) {
        this.authErrorMsg.textContent = errorMessage;
        this.authErrorMsg.classList.remove('hidden');
      }
    },

    showDashboardView() {
      this.authView.classList.add('hidden');
      this.dashboardView.classList.remove('hidden');
      this.userEmailDisplay.textContent = this.user.email;
      this.userAvatar.textContent = `[${(this.user.username || this.user.email).charAt(0).toUpperCase()}]`;

      this.fetchNotes();
      this.fetchTags();
    },

    async handleLogin(e) {
      e.preventDefault();
      this.clearAuthBanners();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      const submitBtn = this.loginForm.querySelector('button[type="submit"]');
      this.setButtonLoading(submitBtn, true, 'AUTHENTICATING...');

      try {
        const data = await api.login(email, password);
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.user = data.user;
        this.showToast(`AUTHENTICATED // ${data.user.username.toUpperCase()}`, 'success');
        this.showDashboardView();
      } catch (err) {
        this.authErrorMsg.textContent = err.message || 'Login failed.';
        this.authErrorMsg.classList.remove('hidden');
      } finally {
        this.setButtonLoading(submitBtn, false, 'SIGN IN');
      }
    },

    async handleSignup(e) {
      e.preventDefault();
      this.clearAuthBanners();
      const email = document.getElementById('registerEmail').value.trim();
      const username = document.getElementById('registerUsername').value.trim();
      const password = document.getElementById('registerPassword').value;

      const submitBtn = this.registerForm.querySelector('button[type="submit"]');
      this.setButtonLoading(submitBtn, true, 'CREATING ACCOUNT...');

      try {
        const data = await api.signup(email, username, password);
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.user = data.user;
        this.showToast('ACCOUNT INSTANTIATED SUCCESSFULLY', 'success');
        this.showDashboardView();
      } catch (err) {
        this.authErrorMsg.textContent = err.message || 'Registration failed.';
        this.authErrorMsg.classList.remove('hidden');
      } finally {
        this.setButtonLoading(submitBtn, false, 'CREATE ACCOUNT');
      }
    },

    handleLogout() {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      this.user = null;
      this.showToast('SESSION TERMINATED', 'info');
      this.showAuthView();
    },

    async fetchTags() {
      try {
        const tags = await api.getTags();
        this.tags = tags;
        this.renderTagSelectOptions();
      } catch (err) {
        console.error('Failed to load tags', err);
      }
    },

    renderTagSelectOptions() {
      const currentSelected = this.selectedTag;
      this.tagFilterSelect.innerHTML = '<option value="">ALL TAGS</option>';
      this.tags.forEach((tag) => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = `#${tag.toUpperCase()}`;
        if (tag === currentSelected) {
          opt.selected = true;
        }
        this.tagFilterSelect.appendChild(opt);
      });
    },

    async fetchNotes() {
      this.renderLoadingGrid();
      try {
        const notes = await api.getNotes(this.searchQuery, this.selectedTag, this.pinnedOnlyFilter);
        this.notes = notes;
        this.renderNotesGrid();
        this.updateStats();
      } catch (err) {
        this.showToast(err.message || 'Failed to load notes', 'error');
      }
    },

    updateStats() {
      this.totalNotesCount.textContent = this.notes.length;
      const pinnedCount = this.notes.filter(n => n.is_pinned).length;
      this.pinnedNotesCount.textContent = pinnedCount;
    },

    renderLoadingGrid() {
      this.emptyState.classList.add('hidden');
      this.notesGrid.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-500 font-mono text-xs tracking-widest uppercase">
          [ QUERYING DATABASE RECORDS... ]
        </div>
      `;
    },

    renderNotesGrid() {
      this.notesGrid.innerHTML = '';

      if (this.notes.length === 0) {
        this.emptyState.classList.remove('hidden');
        return;
      }

      this.emptyState.classList.add('hidden');

      this.notes.forEach((note) => {
        const card = document.createElement('div');
        card.className = `group relative bg-slate-900 border ${note.is_pinned ? 'border-orange-500' : 'border-slate-800'} p-4 flex flex-col justify-between rounded-none hover:border-orange-500/50 transition-colors`;

        const formattedDate = this.formatDate(note.updated_at);
        const tagsHtml = note.tags
          ? note.tags.split(',')
              .map(t => t.trim())
              .filter(t => t)
              .map(tag => `<span class="tag-pill text-[10px] px-2 py-0.5 bg-slate-950 border border-slate-800 text-orange-400 font-mono uppercase tracking-wider hover:border-orange-500 hover:text-orange-300 cursor-pointer transition-colors" data-tag="${this.escapeHtml(tag)}">#${this.escapeHtml(tag)}</span>`)
              .join(' ')
          : '';

        card.innerHTML = `
          <div>
            <div class="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
              <h3 class="font-bold text-slate-100 text-sm tracking-wide line-clamp-1 uppercase">${this.escapeHtml(note.title)}</h3>
              <button class="pin-btn text-xs font-mono p-1 transition-colors ${note.is_pinned ? 'text-orange-400 font-bold' : 'text-slate-600 hover:text-orange-400'}" data-id="${note.id}" title="${note.is_pinned ? 'UNPIN' : 'PIN'}">
                ${note.is_pinned ? '[PINNED]' : '[PIN]'}
              </button>
            </div>
            <p class="text-slate-300 text-xs whitespace-pre-line line-clamp-4 leading-relaxed mb-4">${this.escapeHtml(note.content)}</p>
          </div>
          <div>
            ${tagsHtml ? `<div class="flex flex-wrap gap-1.5 mb-3">${tagsHtml}</div>` : ''}
            <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 uppercase tracking-wider">
              <span>UPDATED ${formattedDate}</span>
              <div class="flex items-center gap-2 font-bold">
                <button class="edit-btn text-slate-400 hover:text-orange-400 transition-colors" data-id="${note.id}">[EDIT]</button>
                <button class="delete-btn text-slate-500 hover:text-rose-400 transition-colors" data-id="${note.id}">[PURGE]</button>
              </div>
            </div>
          </div>
        `;

        const pinBtn = card.querySelector('.pin-btn');
        pinBtn.addEventListener('click', () => this.togglePinNote(note.id, !note.is_pinned));

        const editBtn = card.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => this.openNoteModal(note));

        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => this.openDeleteModal(note.id));

        const tagPills = card.querySelectorAll('.tag-pill');
        tagPills.forEach(pill => {
          pill.addEventListener('click', (e) => {
            const tagValue = e.currentTarget.getAttribute('data-tag');
            this.selectedTag = tagValue;
            this.tagFilterSelect.value = tagValue;
            this.fetchNotes();
          });
        });

        this.notesGrid.appendChild(card);
      });
    },

    async togglePinNote(noteId, newPinnedState) {
      try {
        await api.updateNote(noteId, { is_pinned: newPinnedState });
        this.fetchNotes();
      } catch (err) {
        this.showToast('FAILED TO UPDATE PIN STATE', 'error');
      }
    },

    openNoteModal(note = null) {
      this.noteForm.reset();
      if (note) {
        this.editingNoteId = note.id;
        this.modalTitle.textContent = 'EDIT RECORD';
        this.noteIdInput.value = note.id;
        this.noteTitleInput.value = note.title;
        this.noteTagsInput.value = note.tags || '';
        this.notePinnedInput.checked = note.is_pinned;
        this.noteContentInput.value = note.content;
      } else {
        this.editingNoteId = null;
        this.modalTitle.textContent = 'CREATE NOTE RECORD';
        this.noteIdInput.value = '';
        this.notePinnedInput.checked = false;
      }

      this.noteModal.classList.remove('hidden');
      this.noteTitleInput.focus();
    },

    closeNoteModal() {
      this.noteModal.classList.add('hidden');
      this.editingNoteId = null;
      this.noteForm.reset();
    },

    async handleSaveNote(e) {
      e.preventDefault();
      const title = this.noteTitleInput.value.trim();
      const content = this.noteContentInput.value.trim();
      const tags = this.noteTagsInput.value.trim();
      const is_pinned = this.notePinnedInput.checked;

      if (!title || !content) {
        this.showToast('TITLE AND CONTENT REQUIRED', 'error');
        return;
      }

      this.setButtonLoading(this.saveNoteSubmitBtn, true, 'SAVING...');

      try {
        const payload = { title, content, tags, is_pinned };
        if (this.editingNoteId) {
          await api.updateNote(this.editingNoteId, payload);
          this.showToast('RECORD UPDATED', 'success');
        } else {
          await api.createNote(payload);
          this.showToast('RECORD INSTANTIATED', 'success');
        }

        this.closeNoteModal();
        this.fetchNotes();
        this.fetchTags();
      } catch (err) {
        this.showToast(err.message || 'Failed to save note', 'error');
      } finally {
        this.setButtonLoading(this.saveNoteSubmitBtn, false, 'SAVE RECORD');
      }
    },

    openDeleteModal(noteId) {
      this.deletingNoteId = noteId;
      this.deleteModal.classList.remove('hidden');
    },

    closeDeleteModal() {
      this.deletingNoteId = null;
      this.deleteModal.classList.add('hidden');
    },

    async handleConfirmDelete() {
      if (!this.deletingNoteId) return;

      this.setButtonLoading(this.confirmDeleteBtn, true, 'PURGING...');

      try {
        await api.deleteNote(this.deletingNoteId);
        this.showToast('RECORD PURGED', 'info');
        this.closeDeleteModal();
        this.fetchNotes();
        this.fetchTags();
      } catch (err) {
        this.showToast(err.message || 'Failed to delete note', 'error');
      } finally {
        this.setButtonLoading(this.confirmDeleteBtn, false, 'PURGE');
      }
    },

    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      const bgColors = {
        success: 'bg-emerald-950 border border-emerald-800 text-emerald-200',
        error: 'bg-rose-950 border border-rose-800 text-rose-200',
        info: 'bg-orange-950 border border-orange-800 text-orange-200',
      };

      toast.className = `px-4 py-3 text-xs font-mono uppercase tracking-wider border rounded-none shadow-xl ${bgColors[type] || bgColors.info}`;
      toast.textContent = message;

      this.toastContainer.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 4000);
    },

    setButtonLoading(btn, isLoading, text) {
      if (isLoading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.innerHTML;
        btn.textContent = text;
      } else {
        btn.disabled = false;
        btn.innerHTML = text || btn.dataset.originalText || 'SUBMIT';
      }
    },

    formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
    },

    escapeHtml(str) {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
  };

  app.init();
});
