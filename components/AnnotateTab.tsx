"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageIcon } from "lucide-react";

const ANNOTATION_OPTIONS = [
  "Lightening Arrestor",
  "Capacitive Voltage Transformer (CVT)",
  "Line Wave Traps (Low Pass Filter)",
  "High Side Disconnect/Isolator",
  "Current Transformer",
  "Circuit Breaker",
  "Connecting Conductors",
  "Upstream Towers/Structures",
  "Power Transformers",
  "Clearances"
];

interface Annotation {
  id: string;
  x: number;
  y: number;
  type: string;
  otherText?: string;
  selected: string[];
}

export default function AnnotateTab() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [formPosition, setFormPosition] = useState({ x: 0, y: 0 });
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");
  const imageRef = useRef<HTMLDivElement>(null);
  const hasImages = false; // This will be controlled by Supabase data

  const handleImageClick = (e: React.MouseEvent) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      x,
      y,
      type: "default",
      selected: [],
    };

    setAnnotations([...annotations, newAnnotation]);
    setActiveAnnotation(newAnnotation);
    setShowAnnotationForm(true);
    setFormPosition({ x: e.clientX, y: e.clientY });
  };

  const handleCheckboxChange = (option: string) => {
    setSelectedOptions(prev => 
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  const handleSaveAnnotation = () => {
    if (activeAnnotation) {
      const updatedAnnotations = annotations.map(ann =>
        ann.id === activeAnnotation.id
          ? { ...ann, selected: selectedOptions, otherText }
          : ann
      );
      setAnnotations(updatedAnnotations);
      setShowAnnotationForm(false);
      setSelectedOptions([]);
      setOtherText("");
    }
  };

  if (!hasImages) {
    return (
      <div className="grid grid-cols-[300px_1fr] gap-6 mt-6">
        <Card className="p-4 bg-white shadow-md text-navy-900">
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <ImageIcon className="w-12 h-12 text-navy-300 mb-4" />
            <p className="text-navy-600">No images currently uploaded</p>
          </div>
        </Card>

        <Card className="p-4 bg-white shadow-md">
          <div className="flex flex-col items-center justify-center h-[600px] text-center">
            <ImageIcon className="w-16 h-16 text-navy-300 mb-4" />
            <p className="text-navy-600">Click on an image to begin annotation</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[300px_1fr] gap-6 mt-6">
      <Card className="p-4 bg-white shadow-md text-navy-900">
        <div className="mb-4">
          <img
            src="/preview-image.jpg"
            alt="Preview"
            className="w-full h-40 object-cover rounded-lg"
          />
        </div>
        <div className="space-y-2">
          <p className="font-semibold">Uploaded by:</p>
          <p>Eduardo</p>
        </div>
      </Card>

      <Card className="p-4 bg-white shadow-md relative">
        <div
          ref={imageRef}
          className="w-full h-[600px] relative cursor-crosshair"
          onClick={handleImageClick}
        >
          <img
            src="/preview-image.jpg"
            alt="Main"
            className="w-full h-full object-contain"
          />

          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              className="absolute w-4 h-4 bg-navy-500 rounded-full -translate-x-2 -translate-y-2 cursor-pointer"
              style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
            />
          ))}
        </div>

        <div className="absolute top-4 right-4 bg-navy-100 px-3 py-1 rounded-full text-navy-900">
          {annotations.length}/10
        </div>

        {showAnnotationForm && activeAnnotation && (
          <Card
            className="absolute bg-white p-4 rounded-lg shadow-lg w-80"
            style={{ left: formPosition.x, top: formPosition.y }}
          >
            <ScrollArea className="h-60">
              {ANNOTATION_OPTIONS.map((option) => (
                <div key={option} className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id={option}
                    checked={selectedOptions.includes(option)}
                    onCheckedChange={() => handleCheckboxChange(option)}
                  />
                  <label htmlFor={option} className="text-sm text-navy-900">{option}</label>
                </div>
              ))}
            </ScrollArea>
            <Input
              placeholder="Other annotation..."
              className="mt-4"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
            />
            <Button
              className="mt-4 w-full bg-navy-600 hover:bg-navy-700"
              onClick={handleSaveAnnotation}
            >
              Save Annotation
            </Button>
          </Card>
        )}
      </Card>
    </div>
  );
}