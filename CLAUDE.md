# AMO OS

Sistema interno de gestão de Ordens de Serviço da **AmoCelular** — assistência técnica em Araraquara/SP.

## Stack

- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind CSS v4
- **Icons:** lucide-react
- **State:** Zustand
- **Routing:** react-router-dom v7
- **PDF:** @react-pdf/renderer
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Deploy:** Vercel

## Dev commands

```bash
npm run dev      # start dev server (port 5173)
npm run build    # production build
npm run preview  # preview production build
```

## Project structure

```
src/
  components/
    layout/     # AppShell, BottomNav
    ui/         # IconBtn, CardBox, Row, StatusBadge, OrderRow
  lib/
    constants.ts   # STATUS_CONFIG, CHECK_ENTRADA, brl(), MARCAS
    supabase.ts    # Supabase client (demo mode if no env vars)
    utils.ts       # formatTimeAgo, formatDate, generateId, cn
    generate-pdf.tsx  # PDF generation with @react-pdf/renderer
  pages/
    Home.tsx, OrderList.tsx, OrderDetail.tsx, NewOrder.tsx,
    Notifications.tsx, Clients.tsx, Settings.tsx, Reports.tsx, Login.tsx
  store/
    useStore.ts    # Zustand store with demo data
  types/
    database.ts    # All TypeScript interfaces
supabase/
  migrations/     # 001_initial.sql, 002_seed.sql
  functions/
    check-reminders/   # Edge Function: alerts for ready devices
    whatsapp-report/   # Edge Function: daily/weekly WhatsApp reports
```

## Brand colors

- Brand red: `#D71920`
- Surface: `#0A0A0B`
- Card: `#141416`
- Elevated: `#161618`

## Environment variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Without these, the app runs in demo mode with fake data.

## Supabase Edge Functions env vars

```
WHATSAPP_API_URL=       # Evolution API or Z-API base URL
WHATSAPP_API_KEY=       # API key
WHATSAPP_INSTANCE=      # Instance name
```
