import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandMenu } from './CommandMenu'

export function Shell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#fbfbfa] dark:bg-[#090a0f] text-zinc-900 dark:text-zinc-100">
      {/* Sidebar Rail */}
      <Sidebar />

      {/* Main Workspace Column */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Command Menu Modal */}
      <CommandMenu />
    </div>
  )
}
