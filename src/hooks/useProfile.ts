import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile } from '@/types/database'

export function useProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as Profile
    },
    enabled: !!user?.id,
  })

  const updateProfile = useMutation({
    mutationFn: async (payload: Partial<Pick<Profile, 'farm_name' | 'settings'>>) => {
      if (!user?.id) throw new Error('Not authenticated')
      const updatePayload = { ...payload, updated_at: new Date().toISOString() }
      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload as never)
        .eq('id', user.id)
        .select()
        .single()
      if (error) throw error
      return data as Profile
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    updateProfile,
    refetch: query.refetch,
  }
}
