-- =====================================================
-- Hygiena+ — CORRECTIF : checkout de confiance (montant + stock côté serveur).
--
-- Failles :
--  1) total_amount était calculé côté client et inséré tel quel (le trigger P0-1
--     empêche de le MODIFIER après coup, mais pas de le sous-évaluer à la
--     création) → sous-paiement possible.
--  2) Le stock n'était jamais vérifié ni décrémenté → survente possible.
--
-- Correctif : une fonction RPC SECURITY DEFINER qui, en une transaction :
--   - reprend les PRIX RÉELS des produits (jamais ceux envoyés par le client) ;
--   - vérifie le stock et le décrémente atomiquement (verrou de ligne) ;
--   - recalcule les frais de livraison depuis store_settings ;
--   - insère la commande avec un total_amount de confiance, is_paid=false.
-- Le client appelle create_marketplace_order(...) au lieu d'insérer directement.
-- Idempotent.
-- =====================================================

create or replace function public.create_marketplace_order(
  p_items          jsonb,   -- [{ "product_id": uuid, "quantity": int }]
  p_phone          text,
  p_delivery_mode  text,    -- 'delivery' | 'pickup'
  p_neighborhood   text,
  p_instructions   text,
  p_payment_method text,
  p_payment_phone  text
)
returns public.marketplace_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_item      jsonb;
  v_pid       uuid;
  v_qty       int;
  v_prod      record;
  v_subtotal  numeric := 0;
  v_items     jsonb := '[]'::jsonb;
  v_mode      text := coalesce(nullif(p_delivery_mode, ''), 'delivery');
  v_fee       numeric := 0;
  v_store     record;
  v_zone      jsonb;
  v_zonefee   numeric;
  v_order     public.marketplace_orders;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Panier vide' using errcode = '22023';
  end if;
  if v_mode not in ('delivery', 'pickup') then
    raise exception 'Mode de livraison invalide' using errcode = '22023';
  end if;

  -- 1) Reprix + contrôle/décrément de stock, produit par produit (verrou ligne).
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 then
      raise exception 'Quantité invalide' using errcode = '22023';
    end if;

    select id, name, price, stock into v_prod
    from public.marketplace_products
    where id = v_pid and is_active = true
    for update;

    if not found then
      raise exception 'Produit indisponible' using errcode = '22023';
    end if;
    if v_prod.stock < v_qty then
      raise exception 'Stock insuffisant pour %', v_prod.name using errcode = '22023';
    end if;

    update public.marketplace_products
      set stock = stock - v_qty
      where id = v_pid;

    v_subtotal := v_subtotal + (v_prod.price * v_qty);
    v_items := v_items || jsonb_build_object(
      'product_id', v_prod.id,
      'name', v_prod.name,
      'price', v_prod.price,     -- prix SERVEUR
      'quantity', v_qty
    );
  end loop;

  -- 2) Frais de livraison recalculés serveur (miroir de computeDeliveryFee).
  if v_mode = 'delivery' then
    select default_delivery_fee, free_delivery_threshold, delivery_zones
      into v_store
      from public.store_settings
      order by created_at asc
      limit 1;

    if v_store.free_delivery_threshold is not null and v_subtotal >= v_store.free_delivery_threshold then
      v_fee := 0;
    else
      v_zonefee := null;
      if v_store.delivery_zones is not null and coalesce(trim(p_neighborhood), '') <> '' then
        if jsonb_typeof(v_store.delivery_zones) = 'array' then
          for v_zone in select * from jsonb_array_elements(v_store.delivery_zones) loop
            if lower(trim(v_zone->>'name')) = lower(trim(p_neighborhood)) then
              v_zonefee := (v_zone->>'fee')::numeric;
              exit;
            end if;
          end loop;
        elsif jsonb_typeof(v_store.delivery_zones) = 'object' then
          select value::text::numeric into v_zonefee
          from jsonb_each_text(v_store.delivery_zones)
          where lower(trim(key)) = lower(trim(p_neighborhood))
          limit 1;
        end if;
      end if;
      v_fee := coalesce(v_zonefee, v_store.default_delivery_fee, 0);
    end if;
  end if;

  -- 3) Insertion avec total de confiance (is_paid reste false par défaut).
  insert into public.marketplace_orders (
    user_id, phone, neighborhood, delivery_mode, instructions,
    items, total_amount, payment_method, payment_phone
  ) values (
    v_uid, p_phone,
    case when v_mode = 'delivery' then nullif(trim(p_neighborhood), '') else null end,
    v_mode::public.delivery_mode,
    case when v_mode = 'delivery' then nullif(trim(p_instructions), '') else null end,
    v_items, v_subtotal + v_fee, p_payment_method, p_payment_phone
  )
  returning * into v_order;

  return v_order;
end;
$$;

revoke execute on function public.create_marketplace_order(jsonb, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_marketplace_order(jsonb, text, text, text, text, text, text) to authenticated, service_role;
