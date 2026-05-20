import { create } from 'zustand'
import type { MapColorBy } from '@/components/MapView'

/** Dispatched from Fields page — MapShell reacts and opens the confirmation modal + flow. */
export type FieldFlowType = 'add' | 'draw'

/** Shared map chrome state (MapShell + Fields panel for add-field upsert). */
interface MapShellMapUiState {
  selectedSnapshotId: string | null
  mapSeasonYear: number | null
  mapColorBy: MapColorBy
  useLiveMap: boolean
  setSelectedSnapshotId: (id: string | null) => void
  setMapSeasonYear: (y: number | null) => void
  setMapColorBy: (c: MapColorBy) => void
  setUseLiveMap: (v: boolean | ((prev: boolean) => boolean)) => void
}

export const useMapShellMapUi = create<MapShellMapUiState>((set) => ({
  selectedSnapshotId: null,
  mapSeasonYear: null,
  mapColorBy: 'crop',
  useLiveMap: false,
  setSelectedSnapshotId: (id) => set({ selectedSnapshotId: id }),
  setMapSeasonYear: (y) => set({ mapSeasonYear: y }),
  setMapColorBy: (c) => set({ mapColorBy: c }),
  setUseLiveMap: (v) =>
    set((s) => ({ useLiveMap: typeof v === 'function' ? v(s.useLiveMap) : v })),
}))

interface MapShellFieldUiState {
  /** Increments when user requests add/draw from Fields panel; MapShell consumes `pendingFieldFlow`. */
  fieldFlowNonce: number
  pendingFieldFlow: FieldFlowType | null

  showAddField: boolean
  newName: string
  newAcres: string
  draftBoundary: GeoJSON.Polygon | null
  draftGisAcres: number | null
  draftStaticRingNorm: number[][] | null

  requestFieldFlow: (type: FieldFlowType) => void
  clearPendingFieldFlow: () => void

  setShowAddField: (v: boolean) => void
  setNewName: (v: string) => void
  setNewAcres: (v: string) => void
  setDraftBoundary: (v: GeoJSON.Polygon | null) => void
  setDraftGisAcres: (v: number | null) => void
  setDraftStaticRingNorm: (v: number[][] | null) => void
  resetAddFieldDraft: () => void
}

export const useMapShellFieldUi = create<MapShellFieldUiState>((set) => ({
  fieldFlowNonce: 0,
  pendingFieldFlow: null,

  showAddField: false,
  newName: '',
  newAcres: '',
  draftBoundary: null,
  draftGisAcres: null,
  draftStaticRingNorm: null,

  requestFieldFlow: (type) =>
    set((s) => ({
      fieldFlowNonce: s.fieldFlowNonce + 1,
      pendingFieldFlow: type,
    })),
  clearPendingFieldFlow: () => set({ pendingFieldFlow: null }),

  setShowAddField: (v) => set({ showAddField: v }),
  setNewName: (v) => set({ newName: v }),
  setNewAcres: (v) => set({ newAcres: v }),
  setDraftBoundary: (v) => set({ draftBoundary: v }),
  setDraftGisAcres: (v) => set({ draftGisAcres: v }),
  setDraftStaticRingNorm: (v) => set({ draftStaticRingNorm: v }),
  resetAddFieldDraft: () =>
    set({
      showAddField: false,
      newName: '',
      newAcres: '',
      draftBoundary: null,
      draftGisAcres: null,
      draftStaticRingNorm: null,
    }),
}))
