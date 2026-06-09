<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRepairLab } from '@/composables/useRepairLab'
import { renderPipeline } from '@/engine/RenderPipeline'
import { pluginLoader } from '@/engine/PluginLoader'
import { STATE_ORDER, STATE_COLORS, STATE_NAMES, RARITY_COLORS, RARITY_NAMES } from '@/types'
import type { Item } from '@/types'

const route = useRoute()
const router = useRouter()

const diaryId = computed(() => route.params.id as string)

const {
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
} = useRepairLab(diaryId.value)

const originalCanvasRef = ref<HTMLCanvasElement | null>(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const showApplyConfirm = ref(false)
const applySuccess = ref(false)

const diaryType = computed(() => {
  if (!targetDiary.value) return null
  return pluginLoader.getDiaryType(targetDiary.value.type)
})

const originalStateProgress = computed(() => {
  if (!targetDiary.value) return 0
  const currentIndex = STATE_ORDER.indexOf(targetDiary.value.state)
  return (currentIndex / (STATE_ORDER.length - 1)) * 100
})

const previewStateProgress = computed(() => {
  if (!preview.value) return originalStateProgress.value
  const currentIndex = STATE_ORDER.indexOf(preview.value.previewDiary.state)
  return (currentIndex / (STATE_ORDER.length - 1)) * 100
})

const totalItemCount = computed(() => {
  return selectedItems.value.reduce((sum, s) => sum + s.count, 0)
})

const selectedItemDetails = computed(() => {
  return selectedItems.value.map(s => {
    const item = pluginLoader.getItem(s.itemId)
    return {
      ...s,
      item
    }
  }).filter(s => s.item) as { itemId: string; count: number; item: Item }[]
})

function renderOriginal() {
  if (!originalCanvasRef.value || !targetDiary.value) return
  
  const ctx = originalCanvasRef.value.getContext('2d')
  if (!ctx) return
  
  const decayRate = diaryType.value?.decayRate || 1
  
  if (targetDiary.value.state === 'dead' && targetDiary.value.tombstone) {
    const tombstone = pluginLoader.getTombstone(targetDiary.value.tombstone)
    if (tombstone) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, originalCanvasRef.value.width, originalCanvasRef.value.height)
      tombstone.render(ctx, targetDiary.value)
    }
  } else {
    renderPipeline.render(targetDiary.value, ctx, undefined, decayRate)
  }
}

function renderPreview() {
  if (!previewCanvasRef.value || !preview.value) return
  
  const ctx = previewCanvasRef.value.getContext('2d')
  if (!ctx) return
  
  const decayRate = diaryType.value?.decayRate || 1
  
  if (preview.value.previewDiary.state === 'dead' && preview.value.previewDiary.tombstone) {
    const tombstone = pluginLoader.getTombstone(preview.value.previewDiary.tombstone)
    if (tombstone) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, previewCanvasRef.value.width, previewCanvasRef.value.height)
      tombstone.render(ctx, preview.value.previewDiary)
    }
  } else {
    renderPipeline.render(preview.value.previewDiary, ctx, undefined, decayRate)
  }
}

function render() {
  renderOriginal()
  renderPreview()
}

let renderInterval: number | null = null

onMounted(() => {
  loadDiary()
  render()
  renderInterval = window.setInterval(render, 500)
})

watch([targetDiary, preview], () => {
  render()
}, { deep: true })

function goBack() {
  router.back()
}

function handleApply() {
  showApplyConfirm.value = true
}

function confirmApply() {
  const success = applyRepair()
  if (success) {
    applySuccess.value = true
    showApplyConfirm.value = false
    setTimeout(() => {
      applySuccess.value = false
    }, 2000)
  }
}

function getEffectivenessColor(effectiveness: number): string {
  if (effectiveness >= 1.5) return '#ffd700'
  if (effectiveness >= 1) return '#39ff14'
  if (effectiveness >= 0.5) return '#ff6b35'
  return '#ff0040'
}
</script>

<template>
  <div class="space-y-6" v-if="targetDiary">
    <div class="flex items-center justify-between">
      <button
        class="btn-pixel text-gray-400 border-gray-600 text-sm"
        @click="goBack"
      >
        ← 返回
      </button>
      
      <h1 class="font-vt323 text-2xl text-diary-gold glow-text flex items-center gap-2">
        🔬 修复实验室
        <span class="text-sm text-gray-400 font-normal">
          - {{ targetDiary.title }}
        </span>
      </h1>
      
      <div class="w-20"></div>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <h3 class="font-vt323 text-lg text-gray-400 text-center">
              📷 当前状态
            </h3>
            <div 
              class="crt-container rounded-lg overflow-hidden border-2"
              :style="{ borderColor: STATE_COLORS[targetDiary.state] }"
            >
              <canvas
                ref="originalCanvasRef"
                width="400"
                height="300"
                class="w-full h-auto block"
              ></canvas>
            </div>
            <div class="bg-gray-900/80 rounded-lg p-3 border border-gray-800">
              <div class="flex items-center justify-between mb-2">
                <span 
                  class="state-indicator text-sm"
                  :style="{ color: STATE_COLORS[targetDiary.state], borderColor: STATE_COLORS[targetDiary.state] }"
                >
                  {{ STATE_NAMES[targetDiary.state] }}
                </span>
                <span class="font-vt323 text-sm text-gray-400">
                  衰变: {{ Math.floor((preview?.originalDecayLevel || 0) * 100) }}%
                </span>
              </div>
              <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  class="h-full transition-all duration-500"
                  :style="{ width: `${originalStateProgress}%`, backgroundColor: STATE_COLORS[targetDiary.state] }"
                ></div>
              </div>
            </div>
          </div>
          
          <div class="space-y-2">
            <h3 class="font-vt323 text-lg text-diary-fresh text-center">
              🔮 预演结果
            </h3>
            <div 
              class="crt-container rounded-lg overflow-hidden border-2"
              :style="{ borderColor: preview ? STATE_COLORS[preview.previewDiary.state] : '#666' }"
            >
              <canvas
                ref="previewCanvasRef"
                width="400"
                height="300"
                class="w-full h-auto block"
              ></canvas>
            </div>
            <div class="bg-gray-900/80 rounded-lg p-3 border border-gray-800">
              <div class="flex items-center justify-between mb-2">
                <span 
                  class="state-indicator text-sm"
                  :style="{ 
                    color: preview ? STATE_COLORS[preview.previewDiary.state] : '#666', 
                    borderColor: preview ? STATE_COLORS[preview.previewDiary.state] : '#666' 
                  }"
                >
                  {{ preview?.previewStateName || '选择道具开始预演' }}
                </span>
                <span class="font-vt323 text-sm" :class="preview && preview.previewDecayLevel < preview.originalDecayLevel ? 'text-diary-fresh' : 'text-gray-400'">
                  衰变: {{ Math.floor((preview?.previewDecayLevel || 0) * 100) }}%
                  <span v-if="preview && preview.previewDecayLevel !== preview.originalDecayLevel" class="text-xs">
                    ({{ preview.previewDecayLevel < preview.originalDecayLevel ? '↓' : '↑' }} {{ Math.abs(Math.floor((preview.previewDecayLevel - preview.originalDecayLevel) * 100)) }}%)
                  </span>
                </span>
              </div>
              <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  class="h-full transition-all duration-500"
                  :style="{ width: `${previewStateProgress}%`, backgroundColor: preview ? STATE_COLORS[preview.previewDiary.state] : '#666' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="preview && preview.itemEffects.length > 0" class="bg-gray-900/80 rounded-lg p-4 border border-gray-800">
          <h3 class="font-vt323 text-lg text-diary-gold mb-3">
            📊 效果明细
          </h3>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            <div
              v-for="(effect, index) in preview.itemEffects"
              :key="index"
              class="flex items-center gap-3 p-2 rounded bg-gray-800/50"
              :class="{ 'opacity-50': !effect.willApply }"
            >
              <span class="text-xl">{{ effect.itemIcon }}</span>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-vt323">{{ effect.itemName }}</span>
                  <span 
                    class="text-xs px-1.5 py-0.5 rounded"
                    :style="{ backgroundColor: getEffectivenessColor(effect.effectiveness) + '20', color: getEffectivenessColor(effect.effectiveness) }"
                  >
                    效率 x{{ effect.effectiveness.toFixed(1) }}
                  </span>
                  <span v-if="!effect.willApply" class="text-xs text-red-400">
                    无效
                  </span>
                </div>
                <div class="text-xs text-gray-500">{{ effect.description }}</div>
              </div>
              <div class="text-right font-vt323 text-sm">
                <div v-if="effect.stateChange !== 0" :class="effect.stateChange > 0 ? 'text-diary-fresh' : 'text-red-400'">
                  状态 {{ effect.stateChange > 0 ? '↑' : '↓' }} {{ Math.abs(effect.stateChange) }}
                </div>
                <div v-if="effect.createdAtChange !== 0" class="text-blue-400">
                  时间 +{{ effect.createdAtChange }}
                </div>
                <div v-if="effect.pipelineReset" class="text-purple-400">
                  管线重置
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-4 pt-4 border-t border-gray-700">
            <div class="flex items-center justify-between font-vt323">
              <span class="text-gray-400">总计效果:</span>
              <div class="flex items-center gap-4">
                <span v-if="preview.totalStateChange !== 0" :class="preview.totalStateChange > 0 ? 'text-diary-fresh' : 'text-red-400'">
                  状态 {{ preview.totalStateChange > 0 ? '↑' : '↓' }} {{ Math.abs(preview.totalStateChange) }}
                </span>
                <span v-if="preview.totalCreatedAtChange !== 0" class="text-blue-400">
                  时间 +{{ preview.totalCreatedAtChange }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else class="bg-gray-900/80 rounded-lg p-8 border border-gray-800 text-center">
          <div class="text-4xl mb-3">🧪</div>
          <p class="font-vt323 text-gray-400">
            从右侧选择道具组合，开始预演修复效果
          </p>
        </div>
      </div>
      
      <div class="space-y-4">
        <div class="bg-gray-900/80 rounded-lg p-4 border border-gray-800">
          <h3 class="font-vt323 text-lg text-diary-fresh mb-3 flex items-center justify-between">
            <span>🎒 可用道具</span>
            <span class="text-sm text-gray-400">{{ availableItems.length }} 种</span>
          </h3>
          
          <div v-if="availableItems.length === 0" class="text-center py-4">
            <p class="text-gray-500 font-vt323 text-sm">没有可用的道具</p>
          </div>
          
          <div v-else class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="{ item, count } in availableItems"
              :key="item.id"
              class="p-3 rounded border-2 cursor-pointer transition-all hover:bg-gray-800/50"
              :class="[
                `item-card ${item.rarity}`,
                getItemSelectedCount(item.id) > 0 ? 'border-diary-gold' : ''
              ]"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl">{{ item.icon }}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-vt323 truncate">{{ item.name }}</span>
                    <span 
                      class="text-xs px-1.5 py-0.5 rounded whitespace-nowrap"
                      :style="{ backgroundColor: RARITY_COLORS[item.rarity] + '20', color: RARITY_COLORS[item.rarity] }"
                    >
                      {{ RARITY_NAMES[item.rarity] }}
                    </span>
                  </div>
                  <div class="text-xs text-gray-500 truncate">{{ item.description }}</div>
                </div>
              </div>
              
              <div class="flex items-center justify-between mt-2">
                <span class="font-vt323 text-sm text-gray-400">
                  库存: {{ count }}
                </span>
                <div class="flex items-center gap-2">
                  <button
                    class="w-8 h-8 rounded bg-gray-800 border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-colors font-vt323"
                    :disabled="getItemSelectedCount(item.id) === 0"
                    @click="removeItem(item.id)"
                  >
                    -
                  </button>
                  <span class="font-vt323 text-lg w-8 text-center">
                    {{ getItemSelectedCount(item.id) }}
                  </span>
                  <button
                    class="w-8 h-8 rounded bg-gray-800 border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white transition-colors font-vt323"
                    :disabled="getItemSelectedCount(item.id) >= count"
                    @click="addItem(item.id)"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="selectedItems.length > 0" class="bg-gray-900/80 rounded-lg p-4 border border-diary-gold">
          <h3 class="font-vt323 text-lg text-diary-gold mb-3 flex items-center justify-between">
            <span>✨ 已选组合</span>
            <button
              class="text-xs text-gray-400 hover:text-white"
              @click="clearAllItems"
            >
              清空
            </button>
          </h3>
          
          <div class="space-y-2 max-h-40 overflow-y-auto">
            <div
              v-for="{ item, count } in selectedItemDetails"
              :key="item.id"
              class="flex items-center gap-2 p-2 rounded bg-gray-800/50"
            >
              <span class="text-lg">{{ item.icon }}</span>
              <span class="font-vt323 text-sm flex-1">{{ item.name }}</span>
              <span class="font-vt323 text-diary-gold">x{{ count }}</span>
            </div>
          </div>
          
          <div class="mt-4 pt-4 border-t border-gray-700">
            <div class="flex items-center justify-between mb-4 font-vt323 text-sm">
              <span class="text-gray-400">消耗道具:</span>
              <span class="text-diary-gold">{{ totalItemCount }} 个</span>
            </div>
            
            <button
              class="w-full btn-pixel text-lg"
              :class="preview?.canApply ? 'text-diary-fresh border-diary-fresh' : 'text-gray-600 border-gray-700'"
              :disabled="!preview?.canApply"
              @click="handleApply"
            >
              💫 正式应用修复
            </button>
            
            <p v-if="!preview?.canApply && selectedItems.length > 0" class="text-xs text-red-400 mt-2 text-center">
              {{ preview?.insufficientItems.length ? '库存不足' : '所选道具无法产生有效修复' }}
            </p>
          </div>
        </div>
        
        <div class="bg-gray-900/80 rounded-lg p-4 border border-gray-800">
          <h3 class="font-vt323 text-lg text-blue-400 mb-3">
            💡 使用说明
          </h3>
          <ul class="space-y-2 text-sm text-gray-400 font-vt323">
            <li>• 选择道具组合查看预演效果</li>
            <li>• 预演不会消耗任何道具</li>
            <li>• 确认满意后再正式应用</li>
            <li>• 正式应用后道具才会被消耗</li>
            <li>• 效率低于0.5的道具不会生效</li>
          </ul>
        </div>
      </div>
    </div>
    
    <div v-if="showApplyConfirm" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div class="bg-gray-900 rounded-lg border-2 border-diary-fresh w-full max-w-md">
        <div class="p-6">
          <h3 class="font-vt323 text-xl text-diary-fresh mb-4">
            💫 确认应用修复
          </h3>
          <p class="text-gray-300 font-vt323 mb-4">
            确定要应用以下修复组合吗？
          </p>
          
          <div class="bg-gray-800/50 rounded-lg p-3 mb-4">
            <div class="space-y-1">
              <div
                v-for="{ item, count } in selectedItemDetails"
                :key="item.id"
                class="flex items-center gap-2"
              >
                <span>{{ item.icon }}</span>
                <span class="font-vt323 flex-1">{{ item.name }}</span>
                <span class="font-vt323 text-diary-gold">x{{ count }}</span>
              </div>
            </div>
          </div>
          
          <p class="text-yellow-400 font-vt323 text-sm mb-6">
            ⚠️ 正式应用后，以上道具将被消耗且无法恢复。
          </p>
          
          <div class="flex gap-3">
            <button
              class="flex-1 btn-pixel text-gray-400 border-gray-600"
              @click="showApplyConfirm = false"
            >
              取消
            </button>
            <button
              class="flex-1 btn-pixel text-diary-fresh border-diary-fresh"
              @click="confirmApply"
            >
              确认应用
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="applySuccess" class="fixed top-20 left-1/2 -translate-x-1/2 z-50">
      <div class="bg-diary-fresh/20 border-2 border-diary-fresh text-diary-fresh px-6 py-3 rounded-lg font-vt323 glow-text">
        ✨ 修复成功！
      </div>
    </div>
  </div>
</template>
