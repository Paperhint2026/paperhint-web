import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import { RouterProvider } from "react-router-dom"

import "./index.css"
import { store } from "@/store"
import { ThemeProvider } from "@/components/theme-provider"
import { router } from "@/routes"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </Provider>
  </StrictMode>,
)
