"use client";

import { useState } from "react";
import { useJewelryStore, JEWELRY_TYPES } from "@/stores/jewelry-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Jewelry selector component - Choose jewelry type and configuration
 */

const JEWELRY_CONFIGS = {
  ring: { placement: "hand", icon: "💍", color: "#FFD700" },
  bracelet: { placement: "wrist", icon: "⌚", color: "#C0C0C0" },
  earring: { placement: "ear", icon: "💎", color: "#FFD700" },
  necklace: { placement: "neck", icon: "📿", color: "#FFD700" },
};

const FINGERS = ["thumb", "index", "middle", "ring", "pinky"] as const;
const HANDS = ["left", "right"] as const;

export function JewelrySelector({ className = "" }: { className?: string }) {
  const { selected, setJewelryType, setFinger, setHand, openSelector, closeSelector, is_selector_open } =
    useJewelryStore();

  const [isExpanded, setIsExpanded] = useState(false);

  const handleJewelrySelect = (type: typeof JEWELRY_TYPES[number]) => {
    setJewelryType(type);
  };

  const handleFingerSelect = (finger: typeof FINGERS[number]) => {
    setFinger(finger);
  };

  const handleHandSelect = (hand: typeof HANDS[number]) => {
    setHand(hand);
  };

  const toggleSelector = () => {
    setIsExpanded(!isExpanded);
  };

  const currentConfig = JEWELRY_CONFIGS[selected.jewelry_type as keyof typeof JEWELRY_CONFIGS] ||
                        JEWELRY_CONFIGS.ring;

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span style={{ color: currentConfig.color, fontSize: "24px" }}>
              {currentConfig.icon}
            </span>
            Select Jewelry
          </CardTitle>
          <Badge variant={selected.jewelry_type ? "default" : "outline"}>
            {selected.jewelry_type ? selected.jewelry_type.charAt(0).toUpperCase() + selected.jewelry_type.slice(1) : "None"}
          </Badge>
        </div>
      </CardHeader>

      {!isExpanded ? (
        <CardContent>
          <Button
            onClick={toggleSelector}
            className="w-full"
            variant="outline"
          >
            Configure Jewelry
          </Button>
        </CardContent>
      ) : (
        <CardContent className="space-y-4">
          {/* Jewelry Type Selection */}
          <div className="grid grid-cols-2 gap-3">
            {JEWELRY_TYPES.map((type) => {
              const config = JEWELRY_CONFIGS[type as keyof typeof JEWELRY_CONFIGS];
              const isSelected = selected.jewelry_type === type;

              return (
                <Button
                  key={type}
                  onClick={() => handleJewelrySelect(type)}
                  variant={isSelected ? "default" : "outline"}
                  className={`h-20 flex flex-col items-center justify-center ${
                    isSelected ? "ring-2 ring-offset-2" : ""
                  }`}
                  style={isSelected ? { borderColor: config.color } : {}}
                >
                  <span className="text-2xl mb-1">{config.icon}</span>
                  <span className="text-xs capitalize">{type}</span>
                </Button>
              );
            })}
          </div>

          {/* Finger Selection (for rings) */}
          {selected.jewelry_type === "ring" && (
            <div>
              <label className="text-sm font-medium mb-2 block">Finger:</label>
              <Select value={selected.finger} onValueChange={handleFingerSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select finger" />
                </SelectTrigger>
                <SelectContent>
                  {FINGERS.map((finger) => (
                    <SelectItem key={finger} value={finger}>
                      <span className="capitalize">{finger}</span> finger
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Hand Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Hand:</label>
            <div className="grid grid-cols-2 gap-2">
              {HANDS.map((hand) => (
                <Button
                  key={hand}
                  onClick={() => handleHandSelect(hand)}
                  variant={selected.hand === hand ? "default" : "outline"}
                  className="capitalize"
                >
                  {hand} hand
                </Button>
              ))}
            </div>
          </div>

          {/* Current Selection Display */}
          <div className="bg-muted p-3 rounded-lg space-y-2">
            <div className="text-sm">
              <span className="font-medium">Current:</span>{" "}
              <span className="capitalize">
                {selected.jewelry_type || "None"}
              </span>{" "}
              {selected.jewelry_type === "ring" && (
                <span className="capitalize">on {selected.finger} finger</span>
              )} {" "}
              <span className="capitalize">({selected.hand} hand)</span>
            </div>
            {selected.jewelry_type && (
              <Badge variant="secondary" className="w-full justify-center">
                Ready to try on!
              </Badge>
            )}
          </div>

          <Button onClick={toggleSelector} variant="ghost" className="w-full">
            Close
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
