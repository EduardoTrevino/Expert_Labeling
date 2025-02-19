"use client";

import { useEffect, useState, useRef, MouseEvent } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
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

interface ImageData {
  id: string;
  url: string;
  uploaded_by: string;
  created_at: string;
  completed?: boolean;
}

export default function AnnotateTab() {
  // State for images that still need annotation
  const [images, setImages] = useState<ImageData[]>([]);
  // Currently selected image for annotation
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);

  // Local annotation state for the selected image
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [formPosition, setFormPosition] = useState({ x: 0, y: 0 });
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");

  const imageRef = useRef<HTMLDivElement>(null);

  // Fetch images that are not yet completed
  useEffect(() => {
    const fetchImages = async () => {
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .eq('completed', false)
        .order('created_at', { ascending: false });
      if (error) {
        console.error("Error fetching images:", error);
      } else {
        setImages(data || []);
        if (data && data.length > 0 && !selectedImage) {
          setSelectedImage(data[0]);
        }
      }
    };

    fetchImages();
  }, [selectedImage]);

  // Number of images left to annotate
  const imagesLeftCount = images.length;

  // When a sidebar thumbnail is clicked, select that image
  const handleSelectImage = (img: ImageData) => {
    setSelectedImage(img);
    setAnnotations([]); // reset annotations for a new image
  };

  // Handle click on main image: add a new annotation if not clicking on an existing dot.
  const handleMainImageClick = (e: MouseEvent<HTMLDivElement>) => {
    // If the click comes from a dot, do nothing.
    if ((e.target as HTMLElement).dataset.dot === "true") return;
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
    setAnnotations((prev) => [...prev, newAnnotation]);
    setActiveAnnotation(newAnnotation);
    setShowAnnotationForm(true);
    setFormPosition({ x: e.clientX, y: e.clientY });
  };

  // When clicking on an existing annotation dot, open it for editing.
  const handleEditAnnotation = (e: MouseEvent<HTMLDivElement>, annotation: Annotation) => {
    e.stopPropagation();
    setActiveAnnotation(annotation);
    setSelectedOptions(annotation.selected);
    setOtherText(annotation.otherText || "");
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
      setActiveAnnotation(null);
    }
  };

  const handleDeleteAnnotation = () => {
    if (activeAnnotation) {
      setAnnotations((prev) => prev.filter(ann => ann.id !== activeAnnotation.id));
      setShowAnnotationForm(false);
      setSelectedOptions([]);
      setOtherText("");
      setActiveAnnotation(null);
    }
  };

  // When the user is finished annotating the current image, submit the annotations.
  const handleSubmitAnnotations = async () => {
    if (!selectedImage) return;
    // Insert each annotation into the "annotations" table.
    for (const ann of annotations) {
      const { error } = await supabase
        .from('annotations')
        .insert([
          {
            image_id: selectedImage.id,
            x_coordinate: ann.x,
            y_coordinate: ann.y,
            annotation_type: ann.selected,
            other_text: ann.otherText,
            created_by: selectedImage.uploaded_by, // or your current user
          }
        ]);
      if (error) {
        console.error("Error saving annotation:", error);
      }
    }
    // Mark the image as complete.
    const { error: updateError } = await supabase
      .from('images')
      .update({ completed: true })
      .eq('id', selectedImage.id);
    if (updateError) {
      console.error("Error updating image:", updateError);
    } else {
      // Remove the submitted image from the sidebar.
      setImages(prev => prev.filter(img => img.id !== selectedImage.id));
      setSelectedImage(null);
      setAnnotations([]);
      alert("Annotations submitted successfully!");
    }
  };

  return (
    <div className="flex gap-4 mt-6">
      {/* Sidebar with thumbnails */}
      <div className="w-64 flex flex-col">
        <div className="mb-4 font-semibold text-navy-900">
          {imagesLeftCount} images left to annotate
        </div>
        <ScrollArea className="h-[600px]">
          <div className="flex flex-col space-y-2">
            {images.map(img => (
              <div
                key={img.id}
                className={`flex items-center p-2 rounded hover:bg-navy-50 cursor-pointer ${selectedImage?.id === img.id ? "bg-navy-100" : ""}`}
                onClick={() => handleSelectImage(img)}
              >
                <img src={img.url} alt="Thumbnail" className="w-16 h-16 object-cover rounded" />
                <div className="ml-2 text-sm text-navy-700">
                  {img.uploaded_by}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main annotation area */}
      <div className="flex-1">
        {selectedImage ? (
          <Card className="p-4 bg-white shadow-md relative">
            <div
              ref={imageRef}
              className="w-full h-[600px] relative cursor-crosshair"
              onClick={handleMainImageClick}
            >
              <img
                src={selectedImage.url}
                alt="Main"
                className="w-full h-full object-contain"
              />

              {annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  data-dot="true"
                  onClick={(e) => handleEditAnnotation(e, annotation)}
                  className="absolute w-4 h-4 bg-navy-500 rounded-full -translate-x-2 -translate-y-2 cursor-pointer transition-colors hover:bg-red-500"
                  style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
                />
              ))}
            </div>

            {/* Submit button */}
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSubmitAnnotations} className="bg-green-600 hover:bg-green-700 text-white">
                Submit Annotations
              </Button>
            </div>

            {showAnnotationForm && activeAnnotation && (
              <Card
                className="absolute bg-white p-4 rounded-lg shadow-lg w-80 z-10"
                style={{ left: formPosition.x, top: formPosition.y }}
              >
                <ScrollArea className="h-60 mb-2">
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
                <div className="mt-4 flex justify-between space-x-2">
                  <Button onClick={handleSaveAnnotation} className="w-full bg-navy-600 hover:bg-navy-700 text-white">
                    Save Annotation
                  </Button>
                  <Button onClick={handleDeleteAnnotation} className="w-full bg-red-600 hover:bg-red-700 text-white">
                    Delete
                  </Button>
                </div>
              </Card>
            )}
          </Card>
        ) : (
          <div className="p-8 text-center text-navy-600">
            Select an image from the sidebar to begin annotation.
          </div>
        )}
      </div>
    </div>
  );
}
