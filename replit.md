# Trade Radar

## Overview

Trade Radar is a maritime trade intelligence platform that enables users to search and analyze importers, exporters, and their shipment data. The system ingests shipment records from Excel/CSV files (admin-only) and provides search, analytics, and data visualization capabilities. The application follows an ImportYeti-inspired design approach with a focus on data-first presentation and professional B2B user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript for type safety and component development
- Vite as the build tool and development server
- Wouter for client-side routing (lightweight alternative to React Router)
- shadcn/ui component library built on Radix UI primitives for accessible UI components

**State Management & Data Fetching**
- TanStack Query (React Query) for server state management and caching
- Query client configured with infinite stale time and disabled refetching for controlled data freshness
- Custom query functions with authentication handling (401 behavior configurable)

**Styling & Design System**
- Tailwind CSS for utility-first styling
- Custom design tokens defined in CSS variables for theming (light/dark mode support)
- Design guidelines document specifying spacing scale, typography hierarchy, and layout patterns
- Component library follows "New York" style variant from shadcn/ui
- Hybrid design approach: Data-focused patterns inspired by ImportYeti with clean shadcn/ui foundation

**UI Component Structure**
- Reusable components: CompanyCard, KPICard, ShipmentsChart, ShipmentsTable, TopRankingCard, UploadZone, IngestionHistoryTable
- Page components: Home (hero search), SearchResults (company listing), CompanyProfile (analytics dashboard), AdminUpload (file ingestion)
- Header component with compact mode for search bar inclusion

**Data Visualization**
- Recharts library for charting (BarChart for shipments over time)
- Custom TopRankingCard component for displaying top partners/ports/countries/HS codes with visual progress bars

### Backend Architecture

**Runtime & Framework**
- Node.js with Express server
- TypeScript for type safety across the stack
- ESM module system throughout

**API Design**
- RESTful API endpoints under `/api` namespace
- Company search: `/api/companies/search?q={query}&limit={limit}`
- Company details: `/api/companies/:id`
- Company analytics: `/api/companies/:id/stats`, `/api/companies/:id/shipments-over-time`, `/api/companies/:id/top-partners`, etc.
- Shipments retrieval: `/api/companies/:id/shipments` with pagination
- Admin endpoints: `/api/upload`, `/api/ingestions`

**File Upload Processing**
- Multer middleware for handling multipart/form-data uploads
- Supports Excel (.xlsx, .xls) and CSV formats with 50MB file size limit
- Files stored in `uploads/` directory with unique timestamped filenames
- ETL processing module (`server/etl.ts`) for parsing and ingesting shipment data
- Job queue system for background processing of large files

**Data Processing & Normalization**
- **Flexible header mapping**: Automatically recognizes Portuguese and English column names (e.g., "Nome da Empresa", "Razão Social", "Company Name" all map to `company_name`)
- **Accent normalization**: Removes diacritics and standardizes text (e.g., "Número do Embarque" → "numerodoembarque")
- **Company kind translation**: Supports multiple variations (importador/exportador, buyer/seller, comprador/vendedor)
- Company name canonization and fuzzy matching (designed for pg_trgm extension usage)
- Country code normalization to ISO-3166 standard
- Port mapping to UN/LOCODE format
- Deterministic hash-based deduplication for shipment records
- Row-level error logging with detailed failure reasons

### Database Layer

**ORM & Database Driver**
- Drizzle ORM for type-safe database queries
- Neon serverless PostgreSQL driver with WebSocket support
- Schema-first approach with shared schema definitions

**Schema Design**
- `companies` table: Stores importers and exporters with name, kind (importer/exporter), country code
- `shipments` table: Maritime trade records with company references, partner references, port/country data, HS codes, TEUs, weight
- `ingestions` table: Tracks file upload jobs with status, progress, and metadata
- `error_logs` table: Row-level error tracking for failed ingestion records

**Indexing Strategy**
- Company indexes: name (for search), kind, country code
- Shipment indexes: company_id, partner_id, shipment_no, ets (timestamp), hs_code
- Designed to support efficient filtering and aggregation queries

**Storage Interface Pattern**
- Abstract `IStorage` interface defining all data operations
- `DatabaseStorage` implementation encapsulating all database logic
- Methods for search, CRUD operations, statistics aggregation, and top-N queries
- Fuzzy search implementation using ILIKE with wildcards (prepared for pg_trgm integration)

### Authentication & Authorization

**Current State**
- Session-based authentication planned (connect-pg-simple for PostgreSQL session store)
- Role-based access control with admin role for upload functionality
- Admin routes protected but authentication middleware not yet fully implemented

**Planned Implementation**
- Session cookies for maintaining user state
- Admin-only access to `/admin/upload` route and `/api/upload`, `/api/ingestions` endpoints
- Public access to search and company profile endpoints

### Development & Production Workflow

**Development Setup**
- Hot module replacement via Vite
- Replit-specific plugins for error overlay, cartographer, and dev banner
- Express middleware for request logging and performance monitoring
- Database migrations managed via Drizzle Kit

**Build Process**
- Frontend: Vite builds React app to `dist/public`
- Backend: esbuild bundles server code to `dist/index.js` as ESM
- Separate TypeScript type checking via `check` script
- Database schema changes pushed via `db:push` command

**Environment Configuration**
- `DATABASE_URL` required for PostgreSQL connection
- `NODE_ENV` determines development vs production behavior
- Vite config uses different plugin sets based on environment

## External Dependencies

### Database
- **Neon Serverless PostgreSQL**: Managed PostgreSQL database with WebSocket connection support
- **Drizzle ORM**: Type-safe query builder and migration tool
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### UI & Styling
- **shadcn/ui**: Accessible component library built on Radix UI primitives
- **Radix UI**: Unstyled, accessible component primitives (dialogs, dropdowns, forms, etc.)
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: React charting library for data visualization
- **Lucide React**: Icon library

### Data Processing
- **XLSX**: Excel file parsing and manipulation
- **csv-parser**: CSV file parsing
- **Multer**: File upload handling middleware

### Developer Experience
- **TypeScript**: Type safety across frontend and backend
- **Vite**: Fast build tool and dev server
- **Zod**: Runtime type validation and schema definition
- **Drizzle Zod**: Integration between Drizzle ORM and Zod schemas

### Utilities
- **date-fns**: Date manipulation and formatting
- **clsx & tailwind-merge**: Conditional className utilities
- **class-variance-authority**: Type-safe component variant management
- **nanoid**: Unique ID generation
- **wouter**: Lightweight routing library