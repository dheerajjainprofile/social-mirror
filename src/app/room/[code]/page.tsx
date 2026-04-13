import { redirect } from 'next/navigation'

export default async function RoomRedirect({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  redirect(`/mirror/${code}`)
}
