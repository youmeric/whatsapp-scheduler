"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarClock,
  FileText,
  History,
  LogOut,
  MessageCircle,
  User,
  UserCog,
  Users,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { logoutAction } from "@/app/(app)/actions"

const NAV_ITEMS = [
  { href: "/messages", label: "Messages programmés", icon: CalendarClock },
  { href: "/recipients", label: "Destinataires", icon: Users },
  { href: "/templates", label: "Modèles", icon: FileText },
]

const ADMIN_NAV_ITEMS = [
  { href: "/admin/users", label: "Utilisateurs", icon: UserCog },
  { href: "/admin/audit", label: "Journal d'audit", icon: History },
]

type Role = "super_admin" | "admin" | "user"

function isAdminOrAbove(role: Role): boolean {
  return role === "admin" || role === "super_admin"
}

function roleSubtitle(role: Role): string {
  return role === "super_admin"
    ? "Super administrateur"
    : role === "admin"
      ? "Administrateur"
      : "Connecté"
}

export function AppSidebar({
  username,
  role,
}: {
  username: string
  role: Role
}) {
  const pathname = usePathname()
  const initials = username.slice(0, 2).toUpperCase()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageCircle className="size-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-tight">
              WhatsApp
            </span>
            <span className="text-xs text-muted-foreground leading-tight">
              Scheduler
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/")
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdminOrAbove(role) && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_NAV_ITEMS.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/")
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent"
                    tooltip={username}
                  >
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{username}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {roleSubtitle(role)}
                      </span>
                    </div>
                    {role === "super_admin" && (
                      <Badge className="ml-auto group-data-[collapsible=icon]:hidden">
                        Super
                      </Badge>
                    )}
                    {role === "admin" && (
                      <Badge
                        variant="secondary"
                        className="ml-auto group-data-[collapsible=icon]:hidden"
                      >
                        Admin
                      </Badge>
                    )}
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent
                side="top"
                align="end"
                className="min-w-44"
              >
                <DropdownMenuItem disabled className="text-xs">
                  {username}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 w-full cursor-pointer"
                    />
                  }
                >
                  <User className="size-4" />
                  Mon profil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <DropdownMenuItem
                    render={
                      <button
                        type="submit"
                        className="flex items-center gap-2 w-full cursor-pointer"
                      />
                    }
                  >
                    <LogOut className="size-4" />
                    Se déconnecter
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
