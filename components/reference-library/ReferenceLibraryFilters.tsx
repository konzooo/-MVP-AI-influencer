"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import type { ReferenceLibraryFilters } from "@/lib/types";

interface ReferenceLibraryFiltersProps {
  filters: ReferenceLibraryFilters;
  onFiltersChange: (filters: ReferenceLibraryFilters) => void;
  totalImages: number;
  filteredCount: number;
}

export function ReferenceLibraryFilters({ 
  filters, 
  onFiltersChange, 
  totalImages, 
  filteredCount 
}: ReferenceLibraryFiltersProps) {
  const updateFilter = <K extends keyof ReferenceLibraryFilters>(
    key: K, 
    value: ReferenceLibraryFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      indoorOutdoor: "all",
      captureMethod: "all",
      framing: "all",
      expression: "all",
      timeOfDay: "all"
    });
  };

  const hasActiveFilters = 
    filters.search !== "" ||
    filters.indoorOutdoor !== "all" ||
    filters.captureMethod !== "all" ||
    filters.framing !== "all" ||
    filters.expression !== "all" ||
    filters.timeOfDay !== "all";

  return (
    <div className="space-y-4 p-4 border-b border-zinc-800">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder="Search descriptions, tags, or filenames..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Select 
          value={filters.indoorOutdoor} 
          onValueChange={(value) => updateFilter("indoorOutdoor", value as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="indoor">Indoor</SelectItem>
            <SelectItem value="outdoor">Outdoor</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={filters.captureMethod} 
          onValueChange={(value) => updateFilter("captureMethod", value as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Capture" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Captures</SelectItem>
            <SelectItem value="mirror_selfie">Mirror Selfie</SelectItem>
            <SelectItem value="front_selfie">Front Selfie</SelectItem>
            <SelectItem value="non_selfie">Non-Selfie</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={filters.framing} 
          onValueChange={(value) => updateFilter("framing", value as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Framing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Framing</SelectItem>
            <SelectItem value="closeup">Close Up</SelectItem>
            <SelectItem value="chest_up">Chest Up</SelectItem>
            <SelectItem value="waist_up">Waist Up</SelectItem>
            <SelectItem value="full_body">Full Body</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={filters.expression} 
          onValueChange={(value) => updateFilter("expression", value as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Expression" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Expressions</SelectItem>
            <SelectItem value="smile">Smile</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="laugh">Laugh</SelectItem>
            <SelectItem value="serious">Serious</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={filters.timeOfDay} 
          onValueChange={(value) => updateFilter("timeOfDay", value as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Times</SelectItem>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="night">Night</SelectItem>
            <SelectItem value="golden_hour">Golden Hour</SelectItem>
            <SelectItem value="blue_hour">Blue Hour</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Summary and Clear */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {filteredCount} of {totalImages} images
          </Badge>
          {hasActiveFilters && (
            <Button
              onClick={clearFilters}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-zinc-400 hover:text-zinc-100"
            >
              <X className="h-3 w-3 mr-1" />
              Clear filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}