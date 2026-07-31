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
} from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';

function hrefToString(href: NavItem['href']): string {
    if (!href) return '';
    return typeof href === 'string' ? href : href.url;
}

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const page = usePage();

    const isActive = (href: NavItem['href']) => {
        const h = hrefToString(href);
        return h !== '' && h !== '#' ? page.url.startsWith(h) : false;
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
                                defaultOpen={childActive}
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
