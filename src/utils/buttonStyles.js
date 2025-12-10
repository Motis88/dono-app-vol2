/**
 * Consistent button style classes for the entire application
 * All buttons follow the same gradient patterns, shadows, and transitions
 */

// Base button classes - always include these
const BASE_BUTTON = "font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105";

// Size variants
export const BUTTON_SIZES = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
  xl: "px-8 py-4 text-xl",
};

// Color variants with gradients
export const BUTTON_VARIANTS = {
  // Primary action - blue gradient
  primary: `${BASE_BUTTON} bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white`,
  
  // Success action - green gradient
  success: `${BASE_BUTTON} bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white`,
  
  // Danger/Delete - red gradient
  danger: `${BASE_BUTTON} bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white`,
  
  // Secondary - gray gradient
  secondary: `${BASE_BUTTON} bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white`,
  
  // Info - cyan/teal gradient
  info: `${BASE_BUTTON} bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white`,
  
  // Warning - amber/orange gradient
  warning: `${BASE_BUTTON} bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white`,
  
  // Indigo - for special features
  indigo: `${BASE_BUTTON} bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white`,
  
  // Purple/Pink - for highlights
  purple: `${BASE_BUTTON} bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white`,
  
  // Sky blue - for alternative actions
  sky: `${BASE_BUTTON} bg-gradient-to-r from-blue-500 to-sky-600 hover:from-blue-600 hover:to-sky-700 text-white`,
};

// Special button styles
export const SPECIAL_BUTTONS = {
  // Disabled state
  disabled: "opacity-50 cursor-not-allowed",
  
  // Ghost button (outline only)
  ghost: "bg-transparent border-2 hover:bg-opacity-10",
  
  // Full width
  fullWidth: "w-full",
  
  // Icon only (square)
  iconOnly: "p-2 aspect-square flex items-center justify-center",
};

/**
 * Helper function to combine button classes
 * @param {string} variant - One of BUTTON_VARIANTS keys
 * @param {string} size - One of BUTTON_SIZES keys
 * @param {string[]} additional - Additional classes
 * @returns {string} Combined className string
 */
export function getButtonClass(variant = 'primary', size = 'md', ...additional) {
  const classes = [
    BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary,
    BUTTON_SIZES[size] || BUTTON_SIZES.md,
    ...additional
  ];
  return classes.join(' ');
}

/**
 * Pre-built common button combinations
 */
export const COMMON_BUTTONS = {
  // Standard action buttons
  save: getButtonClass('success', 'md'),
  cancel: getButtonClass('secondary', 'md'),
  delete: getButtonClass('danger', 'md'),
  edit: getButtonClass('primary', 'sm'),
  close: getButtonClass('secondary', 'sm'),
  
  // Import/Export buttons
  import: getButtonClass('indigo', 'md'),
  export: getButtonClass('sky', 'md'),
  
  // Large primary CTA
  largeCTA: getButtonClass('primary', 'lg', SPECIAL_BUTTONS.fullWidth),
};
