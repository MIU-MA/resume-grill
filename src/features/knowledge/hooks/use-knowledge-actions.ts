'use client'

import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { createManualKnowledgeItemId, type KnowledgeItem, type KnowledgeItemPatch, type KnowledgeItemInput } from '@/domain/knowledge'

type KnowledgeActionsState = {
  knowledgeItems: KnowledgeItem[]
  setKnowledgeItems: Dispatch<SetStateAction<KnowledgeItem[]>>
  setMasteredBlindSpotIds: Dispatch<SetStateAction<string[]>>
  setDismissedKnowledgeItemIds: Dispatch<SetStateAction<string[]>>
}

export function useKnowledgeActions(ws: KnowledgeActionsState) {
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
      ws.setDismissedKnowledgeItemIds((current) =>
        current.includes(id) ? current : [...current, id],
      )
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
          question: input.question?.trim(),
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

  const restoreItem = useCallback(
    (item: KnowledgeItem) => {
      ws.setKnowledgeItems((items) =>
        items.some((i) => i.id === item.id) ? items : [item, ...items],
      )
      ws.setDismissedKnowledgeItemIds((current) => current.filter((id) => id !== item.id))
      if (item.source === 'blind-spot' && item.status === 'mastered') {
        ws.setMasteredBlindSpotIds((current) =>
          current.includes(item.id) ? current : [...current, item.id],
        )
      }
    },
    [ws],
  )

  return { toggleMastered, removeItem, updateItem, addItem, restoreItem }
}
