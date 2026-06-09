import { ref, computed } from 'vue'
import { useInventoryStore } from '@/stores/inventory'
import { useDiaryStore } from '@/stores/diary'
import { pluginLoader } from '@/engine/PluginLoader'
import { STATE_NAMES, STATE_ORDER, DiaryState } from '@/types'
import type { Diary, SelectedItem, ItemEffectPreview, RepairLabPreview, Item } from '@/types'

export function useRepairLab(diaryId: string) {
  const inventoryStore = useInventoryStore()
  const diaryStore = useDiaryStore()

  const selectedItems = ref<SelectedItem[]>([])
  const targetDiary = ref<Diary | null>(null)

  function loadDiary() {
    const diary = diaryStore.getDiaryById(diaryId)
    if (diary) {
      targetDiary.value = { ...diary }
    } else {
      const archived = diaryStore.archivedDiaries.find(ad => ad.diary.id === diaryId)
      if (archived) {
        targetDiary.value = { ...archived.diary }
      }
    }
  }

  const availableItems = computed(() => {
    if (!targetDiary.value) return []
    const items: { item: Item; count: number }[] = []
    inventoryStore.inventory.forEach(invItem => {
      const item = pluginLoader.getItem(invItem.itemId)
      if (item && item.targetTypes.includes(targetDiary.value!.type) && invItem.count > 0) {
        items.push({ item, count: invItem.count })
      }
    })
    return items
  })

  function getItemSelectedCount(itemId: string): number {
    const selected = selectedItems.value.find(s => s.itemId === itemId)
    return selected ? selected.count : 0
  }

  function getItemAvailableCount(itemId: string): number {
    return inventoryStore.getItemCount(itemId)
  }

  function addItem(itemId: string) {
    const available = getItemAvailableCount(itemId)
    const selected = getItemSelectedCount(itemId)
    if (selected >= available) return

    const existing = selectedItems.value.find(s => s.itemId === itemId)
    if (existing) {
      existing.count++
    } else {
      selectedItems.value.push({ itemId, count: 1 })
    }
  }

  function removeItem(itemId: string) {
    const existing = selectedItems.value.find(s => s.itemId === itemId)
    if (!existing) return

    existing.count--
    if (existing.count <= 0) {
      selectedItems.value = selectedItems.value.filter(s => s.itemId !== itemId)
    }
  }

  function setItemCount(itemId: string, count: number) {
    const available = getItemAvailableCount(itemId)
    const safeCount = Math.max(0, Math.min(count, available))

    if (safeCount === 0) {
      selectedItems.value = selectedItems.value.filter(s => s.itemId !== itemId)
    } else {
      const existing = selectedItems.value.find(s => s.itemId === itemId)
      if (existing) {
        existing.count = safeCount
      } else {
        selectedItems.value.push({ itemId, count: safeCount })
      }
    }
  }

  function clearAllItems() {
    selectedItems.value = []
  }

  function calculateItemEffect(
    item: Item,
    diary: Diary,
    diaryType: any
  ): ItemEffectPreview {
    const effectiveness = item.effectiveness[diary.type] || 1
    const modifier = diaryType?.itemEffectModifiers[item.id.replace(/_(common|rare|epic)$/, '')] || 1
    const willApply = effectiveness * modifier > 0.5

    const newDiary = item.effect(diary)

    const fromState = diary.state
    const toState = newDiary.state
    const stateChange = STATE_ORDER.indexOf(fromState) - STATE_ORDER.indexOf(toState)

    const createdAtChange = newDiary.createdAt - diary.createdAt
    const pipelineReset = JSON.stringify(newDiary.pipeline) !== JSON.stringify(diary.pipeline)

    return {
      itemId: item.id,
      itemName: item.name,
      itemIcon: item.icon,
      description: item.description,
      willApply,
      effectiveness: effectiveness * modifier,
      fromState,
      toState,
      stateChange,
      createdAtChange,
      pipelineReset
    }
  }

  const preview = computed<RepairLabPreview | null>(() => {
    if (!targetDiary.value) return null

    const originalDiary = { ...targetDiary.value }
    let previewDiary = { ...targetDiary.value }
    const itemEffects: ItemEffectPreview[] = []
    const insufficientItems: string[] = []

    const diaryType = pluginLoader.getDiaryType(originalDiary.type)

    let totalStateChange = 0
    let totalCreatedAtChange = 0

    selectedItems.value.forEach(selected => {
      const item = pluginLoader.getItem(selected.itemId)
      if (!item) return

      const available = getItemAvailableCount(selected.itemId)
      if (selected.count > available) {
        insufficientItems.push(selected.itemId)
        return
      }

      for (let i = 0; i < selected.count; i++) {
        const effect = calculateItemEffect(item, previewDiary, diaryType)
        itemEffects.push(effect)

        if (effect.willApply) {
          previewDiary = item.effect(previewDiary)
          totalStateChange += effect.stateChange
          totalCreatedAtChange += effect.createdAtChange
        }
      }
    })

    const originalDecayLevel = diaryStore.getDecayLevel(originalDiary)
    const previewDecayLevel = diaryStore.getDecayLevel(previewDiary)

    const canApply = selectedItems.value.length > 0 &&
      insufficientItems.length === 0 &&
      itemEffects.some(e => e.willApply)

    return {
      originalDiary,
      previewDiary,
      originalDecayLevel,
      previewDecayLevel,
      originalStateName: STATE_NAMES[originalDiary.state],
      previewStateName: STATE_NAMES[previewDiary.state],
      selectedItems: [...selectedItems.value],
      itemEffects,
      totalStateChange,
      totalCreatedAtChange,
      canApply,
      insufficientItems
    }
  })

  function applyRepair(): boolean {
    if (!preview.value || !preview.value.canApply || !targetDiary.value) return false

    const diaryId = targetDiary.value.id
    const isArchived = !diaryStore.getDiaryById(diaryId)

    selectedItems.value.forEach(selected => {
      for (let i = 0; i < selected.count; i++) {
        inventoryStore.useItem(selected.itemId, diaryId)
      }
    })

    clearAllItems()
    loadDiary()

    return true
  }

  loadDiary()

  return {
    targetDiary,
    selectedItems,
    availableItems,
    preview,
    getItemSelectedCount,
    getItemAvailableCount,
    addItem,
    removeItem,
    setItemCount,
    clearAllItems,
    applyRepair,
    loadDiary
  }
}
