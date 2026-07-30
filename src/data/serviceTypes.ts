export interface Service {
  name: string;
  slug: string;
}

export interface ServiceCategory {
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string;
  subcategories: {
    name: string;
    services: Service[];
  }[];
}
