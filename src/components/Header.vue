<script setup>
import { ref, watch } from "vue";
import { Sun, Moon } from "lucide-vue-next";

const theme = ref("dark");
const isDark = ref(true);

function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
  isDark.value = !isDark.value;
}

watch(theme, (newTheme) => {
  document.body.classList.remove("dark", "light");
  document.body.classList.add(newTheme);
});

document.body.classList.add(theme.value);

defineProps({
  msg: String,
});

const count = ref(0);
</script>

<template>
  <header class="header">
    <div id="home" class="logo">
      <a class="logo-link" href="/">Chat App</a>
    </div>
    <div>
      <button class="button" @click="toggleTheme">
        <Sun size="20" v-if="isDark" />
        <Moon size="20" v-else />
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  height: 30px;
}

.header.dark {
  background-color: #121212;
}

.header.light {
  background-color: #ffffff;
}

.logo {
  position: relative;
  left: 50%;
  transform: translateX(-50%);
}

.logo-link {
  padding: 5px;
  text-decoration: none;
  font-weight: bold;
  font-size: 1rem;
  color: inherit;
}

.logo-link.dark,
.logo-link.dark:visited {
  color: #fff;
}

.logo-link.light,
.logo-link.light:visited {
  color: #000;
}

.button {
  background-color: transparent;
  border: none;
  cursor: pointer;
  margin-top: 5px;
}

.button.dark {
  color: #fff;
}

.button.light {
  color: #000;
}
</style>
