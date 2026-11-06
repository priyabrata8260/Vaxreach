import { Activity, BarChart3, ClipboardList, HeartPulse, Settings, Users, UserRound } from 'lucide-react'

export const navigationItems = [
  { label: 'Dashboard', path: '/', Icon: HeartPulse },
  { label: 'Children', path: '/children', Icon: Users },
  { label: 'Vaccination Tracker', path: '/vaccination-tracker', Icon: ClipboardList },
  { label: 'ASHA Workers', path: '/asha-workers', Icon: UserRound },
  { label: 'Outreach', path: '/outreach', Icon: Activity },
  { label: 'Reports', path: '/reports', Icon: BarChart3 },
  { label: 'Settings', path: '/settings', Icon: Settings },
]
