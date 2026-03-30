import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import { RouterProvider } from "react-router-dom"

import "./index.css"
import { store } from "@/store"
import { ThemeProvider } from "@/components/theme-provider"
import { router } from "@/routes"

const hash = window.location.hash
if (hash && (hash.includes("type=invite") || hash.includes("type=magiclink"))) {
  window.location.replace(`/set-password${hash}`)
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </Provider>
  </StrictMode>,
)
