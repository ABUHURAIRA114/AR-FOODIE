import { useEffect, useState } from "react";
import { useParams } from "react-router";
import MenuTemplate, { RestaurantConfig } from "./MenuTemplate";

interface Category {
  id: number;
  name: string;
  image: string;
}

interface Dish {
  id: number;
  name: string;
  description: string;
  price: number;
  startingPrice: boolean;
  image: string;
  arModelUrl: string | null;
  usdzUrl: string | null;
  categoryId: number;
}

export default function RestaurantMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig]         = useState<RestaurantConfig | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes]         = useState<Dish[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`${import.meta.env.VITE_API_URL}/menu-api/${slug}/`)
      .then(r => {
        if (!r.ok) throw new Error("Restaurant not found");
        return r.json();
      })
      .then(data => {
        setConfig({
          name:         data.restaurant.name,
          logo:         data.restaurant.logo,
          primaryColor: data.restaurant.primary_color,
          headerBg:     data.restaurant.header_bg,
        });
        setCategories(data.categories.map((c: any) => ({
          id:    c.id,
          name:  c.name,
          image: c.image,
        })));
        setDishes(data.categories.flatMap((c: any) => c.dishes));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", fontFamily: "'Poppins',sans-serif", color: "#999", fontSize: "1rem" }}>
      Loading menu...
    </div>
  );

  if (error || !config) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", fontFamily: "'Poppins',sans-serif", color: "#e8472a", fontSize: "1rem" }}>
      {error || "Something went wrong"}
    </div>
  );

  return (
    <MenuTemplate
      config={config}
      categories={categories}
      dishes={dishes}
    />
  );
}