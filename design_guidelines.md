# Trade Radar Design Guidelines

## Design Approach

**Hybrid Reference + System Approach**: Drawing inspiration from ImportYeti's data-focused patterns while maintaining a clean, professional design system foundation using shadcn/ui + Tailwind CSS. This is a B2B intelligence platform where clarity, efficiency, and data density take precedence over decorative elements.

**Core Principles**:
- Information-first hierarchy with clear visual prioritization
- Scannable layouts optimized for data consumption
- Professional, trustworthy aesthetic for B2B users
- Consistent patterns across search, analytics, and admin areas

---

## Typography

**Font Families**:
- **Primary**: Inter or Geist (clean, readable, modern sans-serif via Google Fonts CDN)
- **Data/Tables**: Mono font for tabular data (JetBrains Mono or SF Mono)

**Hierarchy**:
- **Page Titles**: text-3xl md:text-4xl font-bold
- **Section Headers**: text-2xl font-semibold
- **Card Titles**: text-lg font-semibold
- **Data Labels**: text-sm font-medium uppercase tracking-wide
- **Body Text**: text-base
- **Metadata/Secondary**: text-sm text-muted-foreground
- **Table Data**: text-sm font-mono

---

## Layout System

**Spacing Scale**: Use Tailwind units of **2, 4, 6, 8, 12, 16, 20, 24** for consistent rhythm (e.g., p-6, gap-4, space-y-8)

**Container Strategy**:
- **Full-width wrapper**: max-w-7xl mx-auto px-4 md:px-6 lg:px-8
- **Narrow content**: max-w-4xl for focused content areas
- **Dashboard grids**: max-w-none for data-heavy layouts

**Grid Patterns**:
- **KPI Cards**: grid-cols-2 md:grid-cols-4 gap-4
- **Top Rankings**: grid-cols-1 lg:grid-cols-3 gap-6
- **Search Results**: Single column with clear separators
- **Data Tables**: Full-width with horizontal scroll on mobile

---

## Component Library

### Navigation & Header
- **Top Navigation**: Sticky header with logo left, search bar center (on search/company pages), user/admin menu right
- **Search Bar**: Prominent central position on home, compact version in header on other pages
- **Admin Badge**: Visible indicator when admin is logged in with access to /admin routes

### Home Page
- **Hero Section**: Centered search-focused layout (not full viewport height)
  - Large heading introducing the platform value proposition
  - Prominent search bar with placeholder "Search for any importer or exporter..."
  - Search button with icon
  - Optional: "Try a random company" link below
- **Spacing**: py-20 md:py-32 for hero section

### Search Results Page
- **Results List**: Vertical stack of company cards
- **Company Card**: 
  - Company name (text-xl font-semibold)
  - Badge indicating type (Importer/Exporter) with distinct styling
  - Country flag + country name
  - Similarity score indicator
  - Hover state with subtle elevation
  - Padding: p-6, gap: space-y-4 between cards

### Company Profile Page

**Header Section**:
- Company name (text-3xl font-bold)
- Type badges (Importer/Exporter)
- Country information with flag
- Partner count metadata

**KPI Cards** (4-column grid on desktop, 2-column on mobile):
- Large number (text-3xl font-bold)
- Label below (text-sm uppercase)
- Icon or visual indicator
- Subtle background with border
- Padding: p-6

**Timeline Chart**:
- Full-width section with title "Shipments Over Time"
- Bar or line chart showing monthly shipments
- Height: h-80
- Recharts implementation with clean styling
- Margin: mb-12

**Top Rankings Section** (3-column grid on desktop, stacked on mobile):
- **Each ranking card**:
  - Section title (e.g., "Top Partners")
  - Ordered list (top 10-15 items)
  - Each item: Name + Count/percentage bar
  - Padding: p-6
  - Border and subtle background

**HS Codes Section**:
- Similar card layout to rankings
- Code + description format
- Visual hierarchy with HS code in mono font

**Shipments Table**:
- **Filter Bar**: Sticky below header
  - Date range picker (From/To)
  - HS Code filter (searchable dropdown)
  - Country filter (searchable dropdown)
  - Port filter (searchable dropdown)
  - Export CSV button (prominent, primary style)
  - Spacing: gap-4, padding: p-4
- **Table**: 
  - Striped rows for readability
  - Fixed header on scroll
  - Columns: Shipment No, ETS, ETA, Partner, Origin, Destination, HS Code, TEUs, Weight
  - Right-aligned numbers
  - Mono font for dates and numbers
  - Pagination at bottom (page numbers + prev/next)

### Admin Upload Area (/admin)

**Upload Interface**:
- **Drag-and-drop zone**: 
  - Dashed border, min-h-64
  - Icon (upload cloud)
  - Text: "Drag and drop Excel/CSV file or click to browse"
  - Max file size indicator
  - Accepted formats display
- **Upload Button**: Primary, full-width within zone
- **Progress Bar**: Show during upload with percentage

**Ingestion History Table**:
- Columns: Filename, Upload Date, Status, Rows Total, Rows OK, Rows Failed, Actions
- Status badges with distinct states (Queued, Processing, Done, Failed, Canceled)
- Action buttons: View Errors, Reprocess, Cancel
- Sort by date (newest first)

**Error Details Modal/Page**:
- Table showing: Row Number, Error Code, Error Message, Raw Data Preview
- Filterable by error code
- Export errors to CSV option

---

## Visual Design Patterns

**Cards & Containers**:
- Border: border border-border
- Background: bg-card
- Radius: rounded-lg
- Shadow: Use sparingly, shadow-sm on hover

**Badges**:
- Importer: Distinct styling (e.g., blue tint)
- Exporter: Distinct styling (e.g., green tint)
- Status badges: Color-coded (gray=queued, blue=processing, green=done, red=failed)
- Size: px-3 py-1, text-xs font-medium, rounded-full

**Data Visualization**:
- Charts use muted color palette with one accent for primary data
- Grid lines subtle and minimal
- Clear axis labels
- Tooltips on hover with detailed information

**Forms & Inputs**:
- Standard input height: h-10
- Search bars: h-12 for prominence
- Focus states with ring
- Clear error states with red tint and message below

**Buttons**:
- Primary: Solid, prominent for main actions (Search, Upload, Export)
- Secondary: Outlined for secondary actions
- Ghost: Minimal for tertiary actions
- Icon buttons: Square, same height as text buttons
- Size: h-10 default, h-12 for prominent actions

**Empty States**:
- Icon + message for no results/data
- Helpful text suggesting actions
- Center-aligned in container

---

## Responsive Behavior

- **Mobile (< 768px)**: Single column layouts, stacked KPIs, hamburger menu if needed
- **Tablet (768px - 1024px)**: 2-column grids, responsive tables with horizontal scroll
- **Desktop (> 1024px)**: Full multi-column layouts, all features visible

**Table Responsiveness**: Horizontal scroll on mobile, full view on desktop with sticky first column option

---

## Icons

**Library**: Lucide React (via shadcn/ui) or Heroicons
**Common Icons**:
- Search: magnifying glass
- Upload: cloud-upload
- Export: download
- Filter: funnel
- Calendar: calendar
- Error: alert-circle
- Success: check-circle
- Company: building
- Ship: anchor or ship
- Port: map-pin

---

## Animation & Interaction

**Minimal Animations**:
- Subtle transitions on hover (transition-all duration-200)
- Loading states with spinners for async operations
- Chart animations on load (Recharts built-in)
- No decorative or distracting motion

**Micro-interactions**:
- Button hover: slight opacity change
- Card hover: elevation increase
- Input focus: ring appearance

---

## Accessibility

- All interactive elements keyboard accessible
- Proper focus states throughout
- ARIA labels for screen readers
- Sufficient contrast ratios for text
- Form inputs with associated labels
- Error messages clearly linked to inputs

This design creates a professional, efficient data intelligence platform optimized for B2B users who need quick access to maritime trade information with minimal visual distraction.