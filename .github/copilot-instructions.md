# Dono App Vol2 - AI Coding Agent Instructions

## Project Overview
**Personal blood bank management application** for veterinary practice - **single-user system** (not multi-user).
Built as a Capacitor hybrid mobile app (React + Vite) for Android/iOS.

### Primary Purpose
- **Blood donor database management** - Track potential and actual donors across multiple clinic locations
- **Data collection for statistical analysis** - Accumulate comprehensive blood work data as sample size grows
- **Donation eligibility tracking** - Monitor 90-day intervals for re-donation
- **Private owner coordination** - Manage contact information for animals with private owners

### Key Design Principles
- **Personal workflow optimization** - UI/UX tailored for single veterinarian use
- **Data-first approach** - Every field matters for future statistical analysis
- **Offline-capable** - localStorage-based to work without internet
- **Simple backup/restore** - No cloud sync, manual JSON/CSV export for safety

## Core Architecture

### Data Flow Pattern
- **Central Storage**: `src/utils/storage.js` provides localStorage abstraction with `donorStorage` object
- **State Management**: Pure React hooks - no external state library
- **Data Normalization**: All donor records get stable IDs via `withStableId()` in `TablesByLocation.jsx`
- **Deduplication**: Records deduplicated by ID using `dedupeById()` pattern

### Key Components Structure
```
App.jsx - Main router with swipe navigation between 4 views
├── DonorForm.jsx - Form with location/date persistence and validation
├── TablesByLocation.jsx - Location-filtered tables with highlighting system  
├── DonorDashboard.jsx - Analytics wrapper around pivot tables
└── ExternalCells.jsx - Manual donor list management
```

## Critical Patterns

### Donor Data Model
```javascript
// Required fields: date, location, animalName, animalType
// Location normalization via normalizeLocation() is essential
// ID generation: heuristic-based or UUID fallback in withStableId()
```

### Location-Based Filtering
- Hebrew location constants in `LOCATIONS` array
- Active location stored in localStorage as `"active_location"`
- Special location ordering: "בית עובד" first, "רחובות" last

### Highlighting System
- Animals eligible for re-donation (90+ days) auto-highlighted yellow
- Users can remove highlights - stored in `"removed_highlights"` localStorage array
- Check eligibility with `isAnimalHighlighted()` in `donorUtils.js`

### Mobile-First UI
- Tailwind CSS with gradient buttons and responsive cards/tables
- Swipe navigation between views (disabled inside scrollable elements)
- Modal overlays for detailed donor information

## Development Workflow

### Build Commands
```bash
npm run dev          # Vite dev server
npm run build        # Production build to dist/
npm run preview      # Preview production build
npx cap run android  # Run on Android device/emulator
```

### Data Management
- Import/Export via JSON files with automatic normalization
- Capacitor filesystem for mobile file operations
- Form state persists location/date for UX convenience

## Integration Points

### Capacitor Native Features
- `@capacitor/filesystem` - File operations and storage
- `@capacitor/share` - Native sharing functionality
- Config in `capacitor.config.json` with `webDir: "dist"`

### External Libraries
- `react-swipeable` - Touch gesture navigation
- `papaparse`/`xlsx` - File format support
- `uuid` - ID generation fallback
- `recharts` - Dashboard analytics

## Code Conventions

### File Organization
- Utils in `src/utils/` with single responsibility (storage, validation, constants)
- Components have PropTypes validation
- Lazy loading for code splitting in main App.jsx

### Error Handling
- Safe JSON parsing with fallbacks in `storage.js`
- Form validation with user-friendly error display
- Graceful degradation for missing data fields

### Styling
- Consistent gradient button patterns: `bg-gradient-to-r from-{color}-500 to-{color}-600`
- Hover effects with transform scaling and shadow changes
- Mobile-first responsive design with `block md:hidden` patterns

---

## AI Agent Working Guidelines

### Communication Style
- **Language**: Respond in Hebrew when addressing the user (more comfortable for Israeli veterinarian)
- **Brevity**: Keep responses concise - implement directly instead of long explanations
- **Action-oriented**: Show working code rather than describing what you'll do
- **No unnecessary docs**: Don't create markdown summary files unless explicitly requested
- **Emojis**: Use sparingly, only when adding clarity

### Implementation Approach
1. **Start with data layer**: Always update `storage.js` and utility functions first before UI
2. **Preserve compatibility**: NEVER break existing localStorage structure - only add fields, never remove/rename
3. **Test with scale**: Consider performance with 500+ donor records
4. **Batch operations**: Use `multi_replace_string_in_file` for multiple edits to save time
5. **Maintain workflow**: Don't change existing UI patterns without explicit permission

### Code Quality Priorities (in order)
1. **Data safety** - Never lose or corrupt donor records
2. **Backward compatibility** - Old JSON backups must always work
3. **User workflow efficiency** - Fast data entry is critical for clinic use
4. **Code quality** - Clean but pragmatic, not over-engineered
5. **Visual polish** - Good UX but not at expense of functionality

### Project-Specific Knowledge
- **CSV Structure**: Column B = date, J = owner, L = animal name (Medicine Usage exports)
- **External Sales**: Detected by "חיצוני" keyword in product name (Hebrew)
- **Build Process**: `npm run build` → `npx cap copy android` → `npx cap sync android`
- **UI Language**: Keep all user-facing text in Hebrew unless explicitly asked to translate
- **Dark Mode**: Implemented via ThemeContext, respect user's theme preference

### Quick Command Interpretations
- "תעשה commit" = Stage all files and commit with descriptive message
- "בנה" or "build" = Run full build and copy to Android
- "תתקן" = Find the issue, fix it, and verify the fix
- "תוסיף" = Implement the feature end-to-end (data + UI + testing)
- "מה דעתך" = Provide 2-3 specific recommendations with clear priorities

### What to Avoid
❌ Breaking existing data structures
❌ Adding dependencies without discussion
❌ Changing working UI/UX without asking
❌ Over-engineering simple features
❌ Long explanations before taking action
❌ Creating summary markdown files after every change

### Git Commit Style
- Use clear, descriptive commit messages in English
- Group related changes together
- Mention component names and purpose
- Example: "Add expiration date tracking to InventoryManager - alerts for expiring units"