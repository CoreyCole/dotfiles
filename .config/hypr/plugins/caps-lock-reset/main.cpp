#include <hyprland/src/devices/IKeyboard.hpp>
#include <hyprland/src/managers/SeatManager.hpp>
#include <hyprland/src/managers/input/InputManager.hpp>
#include <hyprland/src/plugins/PluginAPI.hpp>

#include <dlfcn.h>
#include <lauxlib.h>
#include <xkbcommon/xkbcommon-names.h>

#include <stdexcept>
#include <string>

static int clear_caps_lock(lua_State *lua) {
  if (!g_pSeatManager || !g_pInputManager)
    return luaL_error(lua, "caps-lock-reset: keyboard managers are not ready");

  const auto active = g_pSeatManager->m_keyboard.lock();
  const auto keyboards = g_pInputManager->m_keyboards;
  bool changed = false;

  for (const auto &keyboard : keyboards) {
    if (!keyboard || !keyboard->m_xkbState || !keyboard->m_xkbKeymap)
      continue;

    const auto caps =
        xkb_keymap_mod_get_index(keyboard->m_xkbKeymap, XKB_MOD_NAME_CAPS);
    if (caps == XKB_MOD_INVALID)
      continue;

    const auto mods = keyboard->m_modifiersState;
    const auto locked = mods.locked & ~(xkb_mod_mask_t{1} << caps);
    if (locked == mods.locked)
      continue;

    keyboard->updateModifiers(mods.depressed, mods.latched, locked, mods.group);
    changed = true;
  }

  // Modifier events select their source keyboard, including inactive devices.
  if (changed) {
    g_pSeatManager->setKeyboard(active);
    if (active)
      g_pInputManager->onKeyboardMod(active);
  }

  return 0;
}

APICALL EXPORT std::string PLUGIN_API_VERSION() { return HYPRLAND_API_VERSION; }

APICALL EXPORT PLUGIN_DESCRIPTION_INFO PLUGIN_INIT(HANDLE handle) {
  if (std::string{__hyprland_api_get_hash()} !=
      __hyprland_api_get_client_hash())
    throw std::runtime_error(
        "caps-lock-reset: ABI mismatch; rebuild for the running Hyprland");

  // An ABI hash does not check symbol binding for inline manager globals.
  if (dlsym(RTLD_DEFAULT, "g_pSeatManager") !=
          static_cast<void *>(&g_pSeatManager) ||
      dlsym(RTLD_DEFAULT, "g_pInputManager") !=
          static_cast<void *>(&g_pInputManager))
    throw std::runtime_error("caps-lock-reset: manager symbols do not resolve "
                             "to Hyprland; rebuild with default visibility");

  if (!HyprlandAPI::addLuaFunction(handle, "caps_lock_reset", "clear",
                                   clear_caps_lock))
    throw std::runtime_error(
        "caps-lock-reset: cannot register the Lua reset function");

  return {"caps-lock-reset",
          "Clear Caps Lock without changing other locked modifiers", "dotfiles",
          "1.1"};
}
