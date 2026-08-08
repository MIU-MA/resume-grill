'use client'

import { useCallback } from 'react'
import { createManualKnowledgeItemId, type KnowledgeItemPatch, type KnowledgeItemInput } from '@/lib/knowledge'
import type { UseResumeWorkspace } from '@/lib/types'

export function useKnowledgeActions(ws: UseResumeWorkspace) {
  const toggleMastered = useCallback(
    (id: string) => {
      const item = ws.knowledgeItems.find((i) => i.id === id)
      if (!item) return
      const nextStatus = item.status === 'mastered' ? 'open' : 'mastered'

      ws.setKnowledgeItems((items) =>
        items.map((i) =>
          i.id === id ? { ...i, status: nextStatus, updatedAt: Date.now() } : i,
        ),
      )

      // blind-spot 项双写 masteredBlindSpotIds（报告页保持一致）
      if (item.source === 'blind-spot') {
        ws.setMasteredBlindSpotIds((current) => {
          const next =
            nextStatus === 'mastered'
              ? current.includes(id)
                ? current
                : [...current, id]
              : current.filter((bid) => bid !== id)
          return next
        })
      }
    },
    [ws],
  )

  const removeItem = useCallback(
    (id: string) => {
      ws.setKnowledgeItems((items) => items.filter((i) => i.id !== id))
      ws.setMasteredBlindSpotIds((current) => current.filter((bid) => bid !== id))
    },
    [ws],
  )

  const updateItem = useCallback(
    (id: string, patch: KnowledgeItemPatch) => {
      ws.setKnowledgeItems((items) =>
        items.map((i) =>
          i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i,
        ),
      )
    },
    [ws],
  )

  const addItem = useCallback(
    (input: KnowledgeItemInput) => {
      const now = Date.now()
      ws.setKnowledgeItems((items) => [
        ...items,
        {
          id: createManualKnowledgeItemId(),
          source: 'manual',
          title: input.title.trim(),
          detail: input.detail?.trim() ?? '',
          claimId: '',
          claimTitle: '',
          status: 'open',
          note: input.note?.trim() ?? '',
          createdAt: now,
          updatedAt: now,
        },
      ])
    },
    [ws],
  )

  return { toggleMastered, removeItem, updateItem, addItem }
}
