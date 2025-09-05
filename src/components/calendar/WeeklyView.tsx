import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { startOfWeek, addDays, format, addWeeks, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";

interface WeeklyViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export function WeeklyView({ currentDate, onDateChange }: WeeklyViewProps) {
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

  const handlePreviousWeek = () => {
    onDateChange(subWeeks(currentDate, 1));
  };

  const handleNextWeek = () => {
    onDateChange(addWeeks(currentDate, 1));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Semaine du {format(startDate, 'dd MMMM yyyy', { locale: fr })}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, index) => (
          <Card key={index} className="min-h-[120px]">
            <CardContent className="p-3">
              <div className="text-sm font-medium mb-2">
                {format(day, 'EEE dd', { locale: fr })}
              </div>
              <div className="space-y-1">
                {/* Placeholder for events */}
                <div className="text-xs text-muted-foreground">
                  Aucun événement
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}