import { redirect } from 'next/navigation'

// /create is replaced by /start in v3.
// Redirect any direct visits so existing bookmarks still work.
export default function CreatePage() {
  redirect('/start')
}
