import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

function hrefToString(href: NavItem['href']): string {
    if (!href) return '';
    return typeof href === 'string' ? href : href.url;
}

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const page = usePage();
    const { state, isMobile, setOpen } = useSidebar();

    const isActive = (href: NavItem['href']) => {
        const h = hrefToString(href);
        return h !== '' && h !== '#' ? page.url.startsWith(h) : false;
    };

    // Grupos desplegados. Arranca abierto el que contiene la vista actual.
    const [abiertos, setAbiertos] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(
            items
                .filter((item) => item.items?.length)
                .map((item) => [
                    item.title,
                    item.items!.some((sub) => isActive(sub.href)),
                ]),
        ),
    );

    // Con el menú contraído (solo íconos) los submenús no se ven: pulsar un
    // grupo expande el menú y deja el grupo abierto, para que sus opciones
    // queden a la vista.
    const alternarGrupo = (titulo: string, abierto: boolean) => {
        if (state === 'collapsed' && !isMobile) {
            setOpen(true);
            setAbiertos((prev) => ({ ...prev, [titulo]: true }));
            return;
        }
        setAbiertos((prev) => ({ ...prev, [titulo]: abierto }));
    };

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel className="text-sidebar-foreground/60">
                Menú principal
            </SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    // Elemento con submenú (grupo desplegable)
                    if (item.items && item.items.length > 0) {
                        const childActive = item.items.some((sub) =>
                            isActive(sub.href),
                        );
                        return (
                            <Collapsible
                                key={item.title}
                                asChild
                                open={abiertos[item.title] ?? childActive}
                                onOpenChange={(v) =>
                                    alternarGrupo(item.title, v)
                                }
                                className="group/collapsible"
                            >
                                <SidebarMenuItem>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton
                                            tooltip={{ children: item.title }}
                                            isActive={childActive}
                                            className="data-[active=true]:bg-white/15"
                                        >
                                            {item.icon && <item.icon />}
                                            <span>{item.title}</span>
                                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            {item.items.map((sub) => (
                                                <SidebarMenuSubItem
                                                    key={sub.title}
                                                >
                                                    <SidebarMenuSubButton
                                                        asChild
                                                        isActive={isActive(
                                                            sub.href,
                                                        )}
                                                        className="data-[active=true]:bg-white/15"
                                                    >
                                                        <Link
                                                            href={
                                                                sub.href ?? '#'
                                                            }
                                                            prefetch
                                                        >
                                                            {sub.icon && (
                                                                <sub.icon />
                                                            )}
                                                            <span>
                                                                {sub.title}
                                                            </span>
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            ))}
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </SidebarMenuItem>
                            </Collapsible>
                        );
                    }

                    // Elemento simple (enlace directo)
                    return (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={isActive(item.href)}
                                tooltip={{ children: item.title }}
                                className="data-[active=true]:bg-white/15 data-[active=true]:font-semibold"
                            >
                                <Link href={item.href ?? '#'} prefetch>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
