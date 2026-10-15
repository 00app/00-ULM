import { notFound } from 'next/navigation'
import { HouseholdGroupClient } from '@/app/components/HouseholdGroupClient'
import { isHouseholdGroup } from '@/lib/household/categories'

export const metadata = {
  title: 'Living',
}

export default async function HouseholdGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  if (!isHouseholdGroup(group)) notFound()
  return <HouseholdGroupClient group={group} />
}
