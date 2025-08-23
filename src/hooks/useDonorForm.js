// src/hooks/useDonorForm.js
import { useState } from "react";

const defaultForm = {
  date: "",
  location: "",
  animalName: "",
  age: "",
  weight: "",
  gender: "",
  animalType: "",
  bloodType: "",
  fiv: "",
  felv: "",
  pcv: "",
  hct: "",
  wbc: "",
  plt: "",
  packedCell: "",
  slideFindings: "",
  donated: "",
  volume: "",
  notes: "",
  isPrivateOwner: false,
};

export const useDonorForm = () => {
  const [formData, setFormData] = useState(() => {
    const lastLocation = localStorage.getItem("last_location") || "";
    const lastDate = localStorage.getItem("last_date") || "";
    return { ...defaultForm, location: lastLocation, date: lastDate };
  });

  const bind = (name) => ({
    name,
    value: formData[name],
    onChange: (e) => {
      const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      const newForm = {
        ...formData,
        [name]: value,
        ...(name === "animalType" ? { bloodType: "", fiv: "", felv: "" } : {}),
      };
      if (name === "location") localStorage.setItem("last_location", value);
      if (name === "date") localStorage.setItem("last_date", value);
      setFormData(newForm);
    },
    ...(typeof formData[name] === "boolean" ? { checked: formData[name] } : {}),
  });

  const setForm = (data) => setFormData(data);
  const resetForm = () => {
    const lastLocation = localStorage.getItem("last_location") || "";
    const lastDate = localStorage.getItem("last_date") || "";
    setFormData({ ...defaultForm, location: lastLocation, date: lastDate });
  };

  return { formData, bind, setForm, resetForm };
};
