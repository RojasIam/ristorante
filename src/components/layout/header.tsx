import Link from "next/link";
import { FaUtensils, FaUser } from "react-icons/fa"; 
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-8 flex items-center space-x-2">
          <FaUtensils className="h-6 w-6" />
          <span className="text-xl font-bold">Ristorante</span>
        </div>
        
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link href="/menu" className="transition-colors hover:text-foreground/80 text-foreground/60">
            Menú
          </Link>
          <Link href="/reservas" className="transition-colors hover:text-foreground/80 text-foreground/60">
            Reservas
          </Link>
          <Link href="/contacto" className="transition-colors hover:text-foreground/80 text-foreground/60">
            Contacto
          </Link>
        </nav>

        <div className="ml-auto flex items-center space-x-4">
          <Button variant="ghost" size="sm">
            <FaUser className="mr-2 h-4 w-4" />
            Iniciar Sesión
          </Button>
          <Button size="sm">Reservar Mesa</Button>
        </div>
      </div>
    </header>
  );
}
