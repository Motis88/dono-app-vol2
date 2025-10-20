import toast from 'react-hot-toast';

/**
 * Toast Utility Functions
 * Centralized toast notifications for consistent UX across the app
 */

export const showToast = {
  // Success messages
  success: (message, options = {}) => {
    return toast.success(message, {
      duration: 4000,
      icon: '✅',
      ...options,
    });
  },

  // Error messages
  error: (message, options = {}) => {
    return toast.error(message, {
      duration: 5000,
      icon: '❌',
      ...options,
    });
  },

  // Warning messages
  warning: (message, options = {}) => {
    return toast(message, {
      duration: 4000,
      icon: '⚠️',
      style: {
        background: '#fef3c7',
        color: '#92400e',
      },
      ...options,
    });
  },

  // Info messages
  info: (message, options = {}) => {
    return toast(message, {
      duration: 3500,
      icon: 'ℹ️',
      style: {
        background: '#dbeafe',
        color: '#1e40af',
      },
      ...options,
    });
  },

  // Loading state
  loading: (message, options = {}) => {
    return toast.loading(message, {
      icon: '⏳',
      ...options,
    });
  },

  // Promise-based toast (auto success/error)
  promise: (promise, messages, options = {}) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading || 'Loading...',
        success: messages.success || 'Success!',
        error: messages.error || 'Error occurred',
      },
      options
    );
  },

  // Dismiss specific toast
  dismiss: (toastId) => {
    toast.dismiss(toastId);
  },

  // Dismiss all toasts
  dismissAll: () => {
    toast.dismiss();
  },

  // Custom toast with custom icon
  custom: (message, icon, options = {}) => {
    return toast(message, {
      icon,
      duration: 4000,
      ...options,
    });
  },

  // Data-specific toasts
  donorAdded: (donorName) => {
    return toast.success(`Donor "${donorName}" added successfully!`, {
      icon: '🩸',
      duration: 4000,
    });
  },

  donorUpdated: (donorName) => {
    return toast.success(`Donor "${donorName}" updated!`, {
      icon: '✏️',
      duration: 3000,
    });
  },

  donorDeleted: (count = 1) => {
    return toast.success(`${count} donor${count > 1 ? 's' : ''} deleted`, {
      icon: '🗑️',
      duration: 3000,
    });
  },

  backupSuccess: (count) => {
    return toast.success(`Backup saved!\n${count} donors backed up`, {
      icon: '📦',
      duration: 4000,
    });
  },

  restoreSuccess: (count) => {
    return toast.success(`Restore complete!\n${count} donors restored`, {
      icon: '♻️',
      duration: 4000,
    });
  },

  importSuccess: (count, type = 'records') => {
    return toast.success(`Import successful!\n${count} ${type} imported`, {
      icon: '📥',
      duration: 4000,
    });
  },

  exportSuccess: (filename) => {
    return toast.success(`Exported to ${filename}`, {
      icon: '📤',
      duration: 3000,
    });
  },

  inventoryUpdated: (product, quantity) => {
    return toast.success(`${product}: ${quantity > 0 ? '+' : ''}${quantity} units`, {
      icon: '📦',
      duration: 3500,
    });
  },

  lowStock: (product, current) => {
    return toast(` Low stock alert!\n${product}: ${current} units remaining`, {
      icon: '⚠️',
      duration: 6000,
      style: {
        background: '#fef3c7',
        color: '#92400e',
      },
    });
  },

  negativeStock: (product) => {
    return toast.error(`Negative stock!\n${product} - Please update received units`, {
      icon: '🚨',
      duration: 7000,
    });
  },
};

export default showToast;
