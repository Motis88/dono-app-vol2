
⚠️ *FOR MAIN AGENT ONLY — SUBAGENTS MUST NOT FOLLOW THIS SECTION* ⚠️

# SUPER MANDATORY CRITICAL MAIN AGENT FEEDBACK LOOP
IF YOU ARE LAUNCHED AS A SUBAGENT - STOP NOW AND IGNORE THIS SECTION. DO NOT FOLLOW THESE INSTRUCTIONS.

## Rules
- The flow with the user MUST be a feedback loop using the vscode_askQuestions tool. After *every single* action or answer, call the vscode_askQuestions tool again with relevant follow-up options and *ALWAYS* include a "That's it" option. *NEVER skip this step.*
- The agent MUST NOT break the loop until the user explicitly selects "That's it". *Any other answer — no matter what — continues the discussion.* Act on the user's response, then call the vscode_askQuestions tool again. *UNDER NO CIRCUMSTANCES may you end the conversation without the user selecting "That's it".*

## INVOKING SUB-AGENTS RULES
- Use parallel sub-agents to improve resposnse time whenever possible!
- When using the runSubagent tool YOU ARE OBLIGATED TO INFORM IT IN INPUT THAT IT IS A SUBAGENT:
"You are a SUBAGENT, you are *NOT THE MAIN AGENT*, IGNORE ANY MAIN AGENT RELATED INSTRUCTIONS!"

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

---

## Performance & Optimization Guidelines

### Performance Considerations
- **localStorage limits**: Keep donor records under 5MB total (browser limit ~10MB)
- **Table rendering**: Use virtualization if donor count exceeds 500 rows
- **Image optimization**: Compress profile photos before storage
- **Lazy loading**: Already implemented for Dashboard/Financial components - maintain pattern
- **Mobile performance**: Test scroll performance on Android devices with 1000+ records

---

## Testing & Validation Protocols

### Testing Checklist Before Commits
1. **Visual Testing**: Always check both light AND dark mode
2. **Data Integrity**: Run with real-scale data (300+ donor records)
3. **Mobile Testing**: Test on actual Android device, not just browser dev tools
4. **Edge Cases**: 
   - Empty states (no donors, no inventory)
   - Negative stock values
   - Hebrew text overflow in mobile view
   - Very long animal names (20+ characters)
5. **localStorage**: Verify import/export works after schema changes

---

## Common Pitfalls & Solutions

### Known Issues & Fixes
- **WebView cache**: Always `npx cap sync` after builds, not just `copy`
- **Date parsing**: Use `normalizeDate()` from donorUtils - Hebrew dates can break
- **Hebrew sorting**: Use `localeCompare('he')` for animal name sorting
- **Negative inventory**: Display as 0 but show warning - never hide the row
- **CSV column shifts**: Medicine Usage exports change column order - always validate Column B/J/L

---

## Data Schema Documentation

### Core Data Structures

**Donor Record:**
```javascript
{
  id: "uuid-or-heuristic",
  date: "YYYY-MM-DD",
  location: "normalized-hebrew",
  animalName: "string",
  animalType: "dog|cat",
  ownerName?: "string",
  ownerPhone?: "string",
  bloodType?: "string",
  lastDonation?: "YYYY-MM-DD",
  notes?: "string"
}
```

**Inventory Record (per product):**
```javascript
{
  stock: number,
  received: number,      // This month
  used: number,         // This month  
  external: number      // This month
}
```

**localStorage Keys:**
- `donors` - Main donor array
- `active_location` - Current location filter
- `removed_highlights` - Array of donor IDs manually unmarked
- `blood_inventory` - Current month inventory state
- `inventory_last_archive` - "YYYY-MM" string for monthly rollover

---

## UI/UX Patterns & Standards

### Consistent Design Patterns

**Colors:**
- Primary actions: `bg-gradient-to-r from-blue-500 to-blue-600`
- Danger: `from-red-500 to-red-600`
- Success: `from-green-500 to-green-600`
- Warning: `yellow-50 dark:yellow-900/30` backgrounds
- Always provide `dark:` variants

**Buttons:**
- Standard: `px-4 py-2 rounded-lg font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02]`
- Compact: `px-3 py-1 rounded-lg text-xs`
- Icon-only: 40×40px minimum touch target

**Modals:**
- Backdrop: `bg-black/40`
- Container: `bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6`
- Always `onClick={e => e.stopPropagation()}` on content

**Tables:**
- Headers: `bg-gradient-to-r from-indigo-500 to-purple-600 text-white`
- Hover: `hover:bg-gray-50 dark:hover:bg-gray-700/30`
- Low stock: `bg-yellow-50 dark:bg-yellow-900/30`
- Negative: `bg-red-50 dark:bg-red-900/30`

---

## Deployment & Build Process

### Production Build Steps
1. `npm run build` - Vite production build
2. `npx cap sync android` - Copy assets + update plugins
3. Android Studio → Clean Project → Rebuild Project
4. Test on device with fresh install (clear data)
5. Increment `versionCode` in `android/app/build.gradle` for updates

### Version Numbering
- Major: Breaking data structure changes (requires migration)
- Minor: New features, UI changes
- Patch: Bug fixes only
- Current: `versionCode 2`, `versionName "1.1"`

---

## Hebrew/RTL Specific Rules

### Hebrew Text Handling
- **Never use CSS `text-align: right`** - use Flexbox `justify-end` instead
- **Date formatting**: Keep ISO (YYYY-MM-DD) in storage, display Hebrew format in UI
- **Number formatting**: Use English numerals (0-9) not Hebrew numerals
- **Location names**: Store normalized Hebrew, display as-is
- **Animal names**: Allow mixed Hebrew/English, sort by `localeCompare('he')`

---

## Security & Privacy Notes

### Data Privacy (Single-User System)
- No cloud sync = no backend security needed
- localStorage is NOT encrypted - inform user if needed
- Owner phone numbers stored in plain text
- Export JSON contains all sensitive data - handle carefully
- No analytics, no tracking, no telemetry

---

## Future Feature Roadmap

### Potential Enhancements (Don't implement without approval)
- Blood type compatibility checker
- Push notifications for re-donation dates
- PDF report generation for clinic records
- Photo attachments for donors
- Backup reminder system
- Export to Excel with formatting
- Search/filter by blood type
- Donor health history tracking

-----