import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AgendaView() {
  const { data: upcomingEvents } = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: async () => {
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

      // Fetch upcoming échéances
      const { data: echeances } = await supabase
        .from("echeances_droit_terre")
        .select(`
          id,
          date_echeance,
          montant,
          numero_echeance,
          souscriptions(
            clients(nom, prenom),
            proprietes(nom)
          )
        `)
        .gte("date_echeance", today.toISOString().split('T')[0])
        .lte("date_echeance", nextMonth.toISOString().split('T')[0])
        .order("date_echeance", { ascending: true });

      return {
        echeances: echeances || []
      };
    }
  });

  const formatEventsByDate = () => {
    const events: { [key: string]: any[] } = {};

    upcomingEvents?.echeances?.forEach(echeance => {
      const date = echeance.date_echeance;
      if (!events[date]) events[date] = [];
      
      events[date].push({
        type: "echeance",
        title: `Échéance #${echeance.numero_echeance}`,
        description: `Droit de terre - ${echeance.montant.toLocaleString()} FCFA`,
        time: "09:00",
        priority: "medium"
      });
    });

    return events;
  };

  const eventsByDate = formatEventsByDate();
  const sortedDates = Object.keys(eventsByDate).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="h-5 w-5" />
        <h3 className="text-lg font-medium">Agenda - Prochains événements</h3>
      </div>

      {sortedDates.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun événement programmé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => (
            <Card key={date}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {new Date(date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {eventsByDate[date].map((event, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {event.time}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{event.title}</h4>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                      <Badge variant={event.priority === 'high' ? 'destructive' : 'secondary'}>
                        {event.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}