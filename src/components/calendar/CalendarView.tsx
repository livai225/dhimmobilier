import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CalendarViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export function CalendarView({ currentDate, onDateChange }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate);

  const { data: eventsData } = useQuery({
    queryKey: ["calendar-events", currentDate.getFullYear(), currentDate.getMonth()],
    queryFn: async () => {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      // Fetch échéances
      const { data: echeances } = await supabase
        .from("echeances_droit_terre")
        .select("date_echeance, montant, numero_echeance")
        .gte("date_echeance", startOfMonth.toISOString().split('T')[0])
        .lte("date_echeance", endOfMonth.toISOString().split('T')[0]);

      return {
        echeances: echeances || []
      };
    }
  });

  const getDayEvents = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const events = [];

    // Add échéances
    const dayEcheances = eventsData?.echeances?.filter(e => e.date_echeance === dateStr) || [];
    events.push(...dayEcheances.map(e => ({
      type: 'echeance',
      title: `Échéance #${e.numero_echeance}`,
      amount: e.montant
    })));

    return events;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) {
              setSelectedDate(date);
              onDateChange(date);
            }
          }}
          className="rounded-md border"
          components={{
            DayContent: ({ date }) => {
              const events = getDayEvents(date);
              return (
                <div className="relative w-full h-full p-1">
                  <span className="text-sm">{date.getDate()}</span>
                  {events.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                      <div className="w-1 h-1 bg-primary rounded-full" />
                    </div>
                  )}
                </div>
              );
            }
          }}
        />
      </div>
      
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">
              Événements du {selectedDate.toLocaleDateString('fr-FR')}
            </h3>
            <div className="space-y-2">
              {getDayEvents(selectedDate).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun événement</p>
              ) : (
                getDayEvents(selectedDate).map((event, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-accent/50 rounded">
                    <span className="text-sm">{event.title}</span>
                    <Badge variant="outline">{event.type}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}