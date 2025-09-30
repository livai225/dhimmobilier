import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type ComboboxOption = {
  value: string
  label: string
  [key: string]: any
}

interface ComboboxProps {
  options?: ComboboxOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  buttonClassName?: string
  onSearchChange?: (search: string) => void
  isLoading?: boolean
}

export function Combobox({
  options = [],
  value = "",
  onChange,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  emptyText = "Aucun résultat trouvé.",
  className,
  buttonClassName,
  onSearchChange,
  isLoading = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  
  // Gestion du délai pour la recherche côté serveur
  React.useEffect(() => {
    if (onSearchChange) {
      const timeoutId = setTimeout(() => {
        onSearchChange(search);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [search, onSearchChange]);

  const filteredOptions = React.useMemo(() => {
    if (!options || !Array.isArray(options)) return [];
    // Si on utilise la recherche côté serveur, retourner toutes les options
    // car le filtrage se fait déjà côté serveur
    if (onSearchChange) {
      return options;
    }
    // Sinon, utiliser le filtrage côté client comme avant
    if (!search.trim()) return options;
    const searchLower = search.toLowerCase();
    return options.filter(option => 
      option?.label?.toLowerCase().includes(searchLower)
    );
  }, [options, search, onSearchChange]);

  const selectedOption = React.useMemo(() => {
    return options?.find(option => option.value === value);
  }, [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", buttonClassName)}
        >
          <span className="truncate">
            {selectedOption?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder={searchPlaceholder}
              className="h-11 border-0 ring-0 focus:ring-0"
              value={search}
              onValueChange={setSearch}
            />
          </div>
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Recherche en cours..." : emptyText}
            </CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-y-auto">
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                    setSearch("")
                  }}
                  className="cursor-pointer"
                  aria-selected={value === option.value}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
