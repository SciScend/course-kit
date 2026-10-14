<script setup>
// Two view modes, kept on <html> as classes:
//   present - bigger text, no sidebars: for the projector in class (key "p")
//   trainer - shows the "Trainer notes" boxes (key "t", or ?trainer in the URL)
import { ref, onMounted, onBeforeUnmount } from 'vue'

const hasNotes = typeof __CK_TRAINER__ !== 'undefined' && __CK_TRAINER__
const present = ref(false)
const trainer = ref(false)

function apply() {
  document.documentElement.classList.toggle('present', present.value)
  document.documentElement.classList.toggle('trainer', trainer.value)
  try {
    localStorage.setItem('ck-modes', JSON.stringify({ present: present.value, trainer: trainer.value }))
  } catch (e) { /* storage blocked - modes just are not remembered */ }
}

function togglePresent() { present.value = !present.value; apply() }
function toggleTrainer() { if (!hasNotes) return; trainer.value = !trainer.value; apply() }

function onKey(e) {
  const t = e.target
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.key === 'p') togglePresent()
  if (e.key === 't') toggleTrainer()
}

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('ck-modes') || '{}')
    present.value = !!saved.present
    trainer.value = hasNotes && !!saved.trainer
  } catch (e) { /* ignore */ }
  if (hasNotes && new URLSearchParams(location.search).has('trainer')) trainer.value = true
  apply()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="mode-toggles">
    <button :class="{ on: present }" title="Presentation mode (key P)" @click="togglePresent">Present</button>
    <button v-if="hasNotes" :class="{ on: trainer }" title="Show trainer notes (key T)" @click="toggleTrainer">Notes</button>
  </div>
</template>
