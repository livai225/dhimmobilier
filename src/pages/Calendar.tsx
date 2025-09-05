import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, Plus, Filter } from "lucide-react";
import { CalendarView } from "@/components/calendar/CalendarView";
import { WeeklyView } from "@/components/calendar/WeeklyView";
import { AgendaView } from "@/components/calendar/AgendaView";
import { AppointmentDialog } from "@/components/calendar/AppointmentDialog";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Planification & Calendrier</h1>
          <p className="text-muted-foreground">
            Gérez vos échéances, rendez-vous et planifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filtres
          </Button>
          <Button size="sm" onClick={() => setShowAppointmentDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau RDV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendrier général
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3">
              <TabsTrigger value="month">Mensuel</TabsTrigger>
              <TabsTrigger value="week">Hebdomadaire</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="month">
                <CalendarView 
                  currentDate={currentDate}
                  onDateChange={setCurrentDate}
                />
              </TabsContent>
              
              <TabsContent value="week">
                <WeeklyView 
                  currentDate={currentDate}
                  onDateChange={setCurrentDate}
                />
              </TabsContent>
              
              <TabsContent value="agenda">
                <AgendaView />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <AppointmentDialog 
        open={showAppointmentDialog}
        onOpenChange={setShowAppointmentDialog}
      />
    </div>
  );
}