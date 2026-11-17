-- INITIAL TRIP DATA (sample/starting data supplied by the trip organiser).
-- Nothing here is invented: unknown times stay NULL, unconfirmed bookings are never 'confirmed'.
-- Re-runnable: does nothing if the trip slug already exists.
create or replace function pg_temp.q(p text) returns text language sql immutable as
$$ select 'https://www.google.com/maps/search/?api=1&query=' || replace(p, ' ', '+') $$;
create or replace function pg_temp.dir(o text, d text) returns text language sql immutable as
$$ select 'https://www.google.com/maps/dir/?api=1&origin=' || replace(o, ' ', '+') || '&destination=' || replace(d, ' ', '+') $$;

do $seed$
declare
  t uuid := '00000000-0000-4000-8000-000000000001';
  d1 uuid; d2 uuid; d3 uuid; d4 uuid; d5 uuid; d6 uuid; d7 uuid; d8 uuid; d9 uuid; d10 uuid; d11 uuid;
  a uuid;
begin
  if exists (select 1 from trips where slug = 'thailand-2026') then return; end if;

  insert into trips (id, name, slug, tagline, start_date, end_date, base_currency, default_thb_to_inr, route_stops)
  values (t, 'Thailand 2026', 'thailand-2026', 'Bangkok · Phuket · Krabi — five friends, eleven days',
          '2026-12-28', '2027-01-07', 'INR', 2.5,
          array['Bangalore','Bangkok','Phuket','Krabi','Bangkok','Bangalore']);
  -- NOTE: default_thb_to_inr is a placeholder editable in Admin → Trip settings; every expense stores its own rate.

  insert into itinerary_days (trip_id, day_number, day_date, city, title, summary, sort_order) values
   (t,1,'2026-12-28','Bangkok','Arrival in Bangkok','Land at Suvarnabhumi, transfer to Asok/Sukhumvit, late dinner and rest.',1) returning id into d1;
  insert into itinerary_days (trip_id, day_number, day_date, city, title, summary, sort_order) values
   (t,2,'2026-12-29','Bangkok','Old Bangkok: Talat Noi, Yaowarat & Wat Arun','Street art, Chinatown street food, the river and Wat Arun.',2) returning id into d2;
  insert into itinerary_days (trip_id, day_number, day_date, city, title, summary, sort_order) values
   (t,3,'2026-12-30','Bangkok','Bangkok daytime, overnight bus to Phuket','Markets or canals, optional cooking class, then the overnight VIP bus south.',3) returning id into d3;
  insert into itinerary_days (trip_id, day_number, day_date, city, title, summary, sort_order) values
   (t,4,'2026-12-31','Phuket','New Year''s Eve in Phuket','Arrive by bus, settle in Patong, beach/pool, then pick a New Year''s Eve party.',4) returning id into d4;
  insert into itinerary_days (trip_id, day_number, day_date, city, title, summary, sort_order) values
   (t,5,'2027-01-01','Phuket','Slow day in Phuket','Sleep in, pool, Kata/Karon, Old Town, massage. Keep it relaxed.',5) returning id into d5;
  insert into itinerary_days (trip_id, day_number, day_date, city, title, summary, sort_order) values
   (t,6,'2027-01-02','Krabi','Phuket → Krabi, Ao Thalane kayaking','Ferry or speedboat to Krabi, check in at Pak-Up Hostel, kayak the mangroves.',6) returning id into d6;
  insert into itinerary_days (trip_id, day_number, day_date, city, title, summary, sort_order) values
   (t,7,'2027-01-03','Krabi','Discover Scuba Diving','Beginner introductory dive, supervised. Possibly first-timers in the group.',7) returning id into d7;
  insert into itinerary_days (trip_id, day_number, day_date, city, title, summary, sort_order) values
   (t,8,'2027-01-04','Krabi','Phi Phi Islands by speedboat','Full-day speedboat tour from Krabi. No overnight on Phi Phi.',8) returning id into d8;
  insert into itinerary_days (trip_id, day_number, day_date, city, title, summary, sort_order) values
   (t,9,'2027-01-05','Krabi','Railay climbing, overnight bus to Bangkok','Beginner guided climbing at Railay, then back to Krabi for the overnight bus.',9) returning id into d9;
  insert into itinerary_days (trip_id, day_number, day_date, city, title, summary, sort_order) values
   (t,10,'2027-01-06','Bangkok','Bangkok: rest and Sukhumvit','Early arrival by bus; rest, malls, cafes, rooftop, dinner.',10) returning id into d10;
  insert into itinerary_days (trip_id, day_number, day_date, city, title, summary, sort_order) values
   (t,11,'2027-01-07','Bangkok','Fly home to Bangalore','Final shopping or massage, check out, airport with a generous buffer. Flight 21:30.',11) returning id into d11;

  -- Day 1
  insert into itinerary_activities (trip_id, day_id, title, description, kind, start_time, time_note, location_name, origin, destination, maps_url, status, sort_order, reminders) values
   (t,d1,'Arrive at Suvarnabhumi (BKK)','Immigration and baggage.','flight','21:30','Arrival 21:30 local time','Suvarnabhumi Airport (BKK)',null,null,pg_temp.q('Suvarnabhumi Airport BKK'),'confirmed',1,'Keep passport, return/onward proof and accommodation address handy for immigration.'),
   (t,d1,'Transfer to Asok / Sukhumvit','Planned transfer to accommodation. Method (taxi/Grab/train) not decided.','transport',null,null,'Asok, Sukhumvit','Suvarnabhumi Airport','Asok Sukhumvit Bangkok',pg_temp.dir('Suvarnabhumi Airport BKK','Asok BTS Station Bangkok'),'suggested',2,null),
   (t,d1,'Late dinner','Something near the hotel.','food',null,null,'Asok / Sukhumvit',null,null,pg_temp.q('restaurants near Asok Bangkok'),'suggested',3,null);
  -- Day 2
  insert into itinerary_activities (trip_id, day_id, title, description, kind, location_name, maps_url, status, sort_order, is_optional) values
   (t,d2,'Talat Noi','Street art and old shophouses.','activity','Talat Noi',pg_temp.q('Talat Noi Bangkok'),'suggested',1,false),
   (t,d2,'Yaowarat (Chinatown) street food','Evening street food.','food','Yaowarat Road',pg_temp.q('Yaowarat Road Bangkok'),'suggested',2,false),
   (t,d2,'Riverside area','Walk by the Chao Phraya.','activity','Chao Phraya riverside',pg_temp.q('Chao Phraya riverside Bangkok'),'suggested',3,false),
   (t,d2,'Wat Arun','Temple of Dawn.','activity','Wat Arun',pg_temp.q('Wat Arun Bangkok'),'suggested',4,false),
   (t,d2,'Dinner and optional nightlife','','food','Bangkok',null,'suggested',5,true);
  -- Day 3
  insert into itinerary_activities (trip_id, day_id, title, description, kind, location_name, maps_url, status, sort_order, is_optional) values
   (t,d3,'Local market or canal neighbourhood','','activity','Bangkok',null,'suggested',1,false),
   (t,d3,'Cooking class','Optional.','activity','Bangkok',null,'suggested',2,true),
   (t,d3,'Massage or shopping','','free','Bangkok',null,'suggested',3,true),
   (t,d3,'Dinner','','food','Bangkok',null,'suggested',4,false);
  insert into itinerary_activities (trip_id, day_id, title, description, kind, time_note, duration_text, location_name, origin, destination, maps_url, meeting_point, transport_info, status, sort_order, reminders) values
   (t,d3,'Overnight VIP bus: Bangkok → Phuket','Preferred: VIP 24. Ticket and exact departure time NOT confirmed.','transport','Earlier timetable estimate ~17:00–17:30 (unconfirmed)','Estimated 12–14 hours','Southern Bus Terminal (Sai Tai Mai)','Southern Bus Terminal Sai Tai Mai','Phuket',pg_temp.dir('Southern Bus Terminal Sai Tai Mai Bangkok','Phuket Bus Terminal'),'Southern Bus Terminal (Sai Tai Mai)','Overnight VIP bus','needs_verification',5,'Verify timetable and buy tickets. Check out of the hotel and plan luggage.');
  -- Day 4
  insert into itinerary_activities (trip_id, day_id, title, description, kind, location_name, maps_url, status, sort_order, reminders) values
   (t,d4,'Arrive in Phuket by overnight bus','Arrival time depends on the bus.','transport','Phuket',null,'needs_verification',1,null),
   (t,d4,'Transfer to Patong accommodation','Drop luggage or check in (early check-in not guaranteed).','stay','Patong',pg_temp.q('Patong Beach Phuket'),'suggested',2,'Confirm early check-in or luggage storage with the hotel.'),
   (t,d4,'Beach / pool and rest','','free','Patong',null,'suggested',3,null);
  insert into itinerary_activities (trip_id, day_id, title, description, kind, location_name, maps_url, status, sort_order, is_optional) values
   (t,d4,'NYE option: Paradise Beach Full Moon Festival','Option only, not booked.','option','Paradise Beach, Phuket',pg_temp.q('Paradise Beach Phuket'),'suggested',4,true),
   (t,d4,'NYE option: The Deck Beach Club Patong','Option only, not booked.','option','Patong',pg_temp.q('The Deck Beach Club Patong'),'suggested',5,true),
   (t,d4,'NYE option: Endless Summer Beach Club','Option only, not booked.','option','Phuket',pg_temp.q('Endless Summer Beach Club Phuket'),'suggested',6,true),
   (t,d4,'NYE option: M Social Phuket pool party','Option only, not booked.','option','Phuket',pg_temp.q('M Social Phuket'),'suggested',7,true);
  -- Day 5
  insert into itinerary_activities (trip_id, day_id, title, kind, location_name, maps_url, status, sort_order) values
   (t,d5,'Sleep in, breakfast and pool','free','Patong',null,'suggested',1),
   (t,d5,'Kata or Karon Beach','activity','Kata / Karon',pg_temp.q('Kata Beach Phuket'),'suggested',2),
   (t,d5,'Phuket Old Town','activity','Phuket Old Town',pg_temp.q('Phuket Old Town'),'suggested',3),
   (t,d5,'Massage','free','Phuket',null,'suggested',4),
   (t,d5,'Dinner','food','Phuket',null,'suggested',5);
  -- Day 6
  insert into itinerary_activities (trip_id, day_id, title, description, kind, location_name, origin, destination, maps_url, transport_info, status, sort_order, reminders) values
   (t,d6,'Phuket → Krabi','Preferably ferry or speedboat. Operator, time and tickets not yet decided.','transport','Phuket','Phuket','Krabi',pg_temp.dir('Phuket','Krabi Town'),'Ferry / speedboat (preferred)','suggested',1,'Choose operator and check the schedule.'),
   (t,d6,'Transfer to Pak-Up Hostel and check in / leave luggage','Krabi Town.','stay','Pak-Up Hostel, Krabi Town',null,null,pg_temp.q('Pak-Up Hostel Krabi Town'),null,'confirmed',2,'Confirm hostel pickup arrangements.'),
   (t,d6,'Ao Thalane kayaking','Guided half-day: mangrove channels and limestone formations. Not booked yet.','activity','Ao Thalane',null,null,pg_temp.q('Ao Thalane Krabi'),null,'suggested',3,'Confirm hostel pickup arrangements.'),
   (t,d6,'Explore Krabi Town, local food, night market (if available)','','food','Krabi Town',null,null,pg_temp.q('Krabi Town night market'),null,'suggested',4,null);
  -- Day 7
  insert into itinerary_activities (trip_id, day_id, title, description, kind, location_name, maps_url, status, sort_order, reminders) values
   (t,d7,'Discover Scuba Diving (beginner)','Supervised introductory dive. Operator previously considered: The Dive Ao Nang. Not booked.','activity','Ao Nang',pg_temp.q('The Dive Ao Nang'),'suggested',1,'Confirm instructor allocation, pickup from Pak-Up, and medical and safety requirements. Ao Nang is ~18 km from Pak-Up (about 20–30 min by road, traffic dependent).');
  -- Day 8
  insert into itinerary_activities (trip_id, day_id, title, description, kind, location_name, maps_url, status, sort_order, reminders) values
   (t,d8,'Phi Phi Islands full-day speedboat tour','Potential stops: Maya Bay, Pileh Lagoon, snorkelling, Phi Phi Don, Bamboo Island (if included). No overnight on Phi Phi. Not booked.','activity','Krabi → Phi Phi',pg_temp.q('Phi Phi Islands'),'suggested',1,'Confirm exact itinerary, park fees, pickup from Pak-Up and the departure point.');
  -- Day 9
  insert into itinerary_activities (trip_id, day_id, title, description, kind, location_name, maps_url, status, sort_order, is_optional) values
   (t,d9,'Beginner guided rock climbing at Railay','Longtail boat transfer. Not booked.','activity','Railay',pg_temp.q('Railay Beach Krabi'),'suggested',1,false),
   (t,d9,'Phra Nang Beach','Optional.','activity','Phra Nang Beach',pg_temp.q('Phra Nang Beach Krabi'),'suggested',2,true),
   (t,d9,'Return to Krabi Town and collect luggage','','transport','Pak-Up Hostel',pg_temp.q('Pak-Up Hostel Krabi Town'),'suggested',3,false);
  insert into itinerary_activities (trip_id, day_id, title, description, kind, time_note, location_name, origin, destination, maps_url, transport_info, status, sort_order, reminders) values
   (t,d9,'Overnight VIP bus: Krabi → Bangkok','Ticket and exact departure time NOT confirmed.','transport','Approx. 17:00 considered (unconfirmed)','Krabi Bus Terminal','Pak-Up Hostel Krabi Town','Krabi Bus Terminal',pg_temp.dir('Pak-Up Hostel Krabi Town','Krabi Bus Terminal'),'Overnight VIP bus','needs_verification',4,'Allow a generous transfer buffer to the terminal.');
  -- Day 10
  insert into itinerary_activities (trip_id, day_id, title, description, kind, location_name, maps_url, status, sort_order, is_optional, reminders) values
   (t,d10,'Arrive in Bangkok and check in at Sukhumvit 31','Arrival is early morning.','stay','Sukhumvit 31',pg_temp.q('Sukhumvit Soi 31 Bangkok'),'pending',1,false,'Early check-in is unlikely: arrange luggage storage or early check-in with the hotel.'),
   (t,d10,'Rest','','free','Sukhumvit 31',null,'suggested',2,false,null),
   (t,d10,'EmQuartier, Emporium and EmSphere','Optional.','activity','Phrom Phong',pg_temp.q('EmQuartier Bangkok'),'suggested',3,true,null),
   (t,d10,'Cafes, rooftop bar and dinner','','food','Bangkok',null,'suggested',4,false,null);
  -- Day 11
  insert into itinerary_activities (trip_id, day_id, title, kind, location_name, maps_url, status, sort_order, is_optional) values
   (t,d11,'Breakfast','food','Bangkok',null,'suggested',1,false),
   (t,d11,'Final shopping or massage','free','Bangkok',null,'suggested',2,true),
   (t,d11,'Check out','stay','Sukhumvit 31',null,'suggested',3,false);
  insert into itinerary_activities (trip_id, day_id, title, kind, start_time, time_note, location_name, origin, destination, maps_url, status, sort_order, reminders) values
   (t,d11,'Travel to Suvarnabhumi Airport','transport',null,'Allow a generous buffer','Suvarnabhumi Airport (BKK)','Sukhumvit 31 Bangkok','Suvarnabhumi Airport BKK',pg_temp.dir('Sukhumvit Soi 31 Bangkok','Suvarnabhumi Airport BKK'),'suggested',4,'Flight departs 21:30. Airline, flight number and terminal to be added.'),
   (t,d11,'Flight BKK → Bangalore','flight','21:30','Departs 21:30 local time','Suvarnabhumi Airport (BKK)','Bangkok','Bangalore',pg_temp.q('Suvarnabhumi Airport BKK'),'confirmed',5,null);

  -- Accommodation (names beyond Pak-Up are not yet chosen)
  insert into accommodation_bookings (trip_id, name, city, address, check_in, check_out, maps_url, notes, status) values
   (t,'Accommodation — Asok / Sukhumvit (to be chosen)','Bangkok','Asok / Sukhumvit area (planned)','2026-12-28','2026-12-30',pg_temp.q('Asok Sukhumvit Bangkok'),'Late arrival 21:30 on 28 Dec: confirm late check-in. Property not yet selected.','pending'),
   (t,'Accommodation — Patong (to be chosen)','Phuket','Patong (planned)','2026-12-31','2027-01-02',pg_temp.q('Patong Beach Phuket'),'Arrives by overnight bus: confirm early check-in or luggage drop. Property not yet selected.','pending'),
   (t,'Pak-Up Hostel','Krabi','Krabi Town','2027-01-02','2027-01-05',pg_temp.q('Pak-Up Hostel Krabi Town'),'Booked for the nights of 2, 3 and 4 Jan; check-out 5 Jan. Add confirmation details when available. Confirm pickup arrangements.','confirmed'),
   (t,'Accommodation — Sukhumvit 31 (to be chosen)','Bangkok','Sukhumvit 31 (planned)','2027-01-06','2027-01-07',pg_temp.q('Sukhumvit Soi 31 Bangkok'),'Arrival is early morning on 6 Jan: arrange early check-in or luggage storage. Property not yet selected.','pending');

  -- Transport
  insert into transport_bookings (trip_id, mode, operator, origin, destination, travel_date, time_note, meeting_point, notes, status) values
   (t,'flight',null,'Bangalore','Bangkok (BKK)','2026-12-28',  'Arrives 21:30 local time','Suvarnabhumi Airport','International flight booked. Airline, flight number, terminal and tickets to be uploaded.','confirmed'),
   (t,'bus','VIP 24 (preferred, unconfirmed)','Bangkok (Southern Bus Terminal, Sai Tai Mai)','Phuket','2026-12-30','Earlier timetable estimate ~17:00–17:30; 12–14 h. Not confirmed','Southern Bus Terminal (Sai Tai Mai)','Ticket and exact departure time not confirmed.','needs_verification'),
   (t,'ferry',null,'Phuket','Krabi','2027-01-02',null,null,'Ferry or speedboat preferred. Operator and time not decided.','suggested'),
   (t,'bus',null,'Krabi Bus Terminal','Bangkok','2027-01-05','Approx. 17:00 considered. Not confirmed','Krabi Bus Terminal','Ticket and exact departure time not confirmed. Allow a transfer buffer.','needs_verification'),
   (t,'flight',null,'Bangkok (BKK)','Bangalore','2027-01-07','Departs 21:30 local time','Suvarnabhumi Airport','International flight booked. Airline, flight number, terminal and tickets to be uploaded.','confirmed');

  -- Activity bookings (none booked yet)
  insert into activity_bookings (trip_id, name, operator, booking_date, notes, status) values
   (t,'Ao Thalane kayaking (guided half-day)',null,'2027-01-02','Not booked. Confirm hostel pickup.','suggested'),
   (t,'Discover Scuba Diving (beginner)','The Dive Ao Nang (previously considered)','2027-01-03','Not booked. Confirm instructor allocation, pickup, medical and safety requirements.','suggested'),
   (t,'Phi Phi Islands full-day speedboat tour',null,'2027-01-04','Not booked. Confirm itinerary, park fees, pickup and departure point.','suggested'),
   (t,'Railay beginner rock climbing',null,'2027-01-05','Not booked.','suggested');

  -- Checklist (applies to every member; each member ticks their own)
  insert into checklist_items (trip_id, category, title, sort_order)
  select t, c, i, row_number() over ()
  from (values
   ('Travel documents','Passport validity checked'),('Travel documents','Entry requirements checked'),
   ('Travel documents','Visa / visa-exemption eligibility checked'),('Travel documents','Travel insurance'),
   ('Travel documents','Flight tickets saved'),('Travel documents','Hotel confirmations saved'),
   ('Travel documents','Bus tickets saved'),('Travel documents','Emergency contacts saved'),
   ('Money & connectivity','Thai Baht arranged'),('Money & connectivity','International card enabled'),
   ('Money & connectivity','Backup payment method'),('Money & connectivity','Roaming / eSIM'),
   ('Money & connectivity','Offline maps downloaded'),
   ('Packing','Backpack'),('Packing','Clothes'),('Packing','Swimwear'),('Packing','Comfortable walking shoes'),
   ('Packing','Sandals'),('Packing','Toiletries'),('Packing','Sunscreen'),('Packing','Sunglasses'),
   ('Packing','Power bank'),('Packing','Chargers and adapters'),('Packing','Personal medication'),
   ('Before departure','Airport transfer arranged'),('Before departure','Online check-in done'),
   ('Before departure','Group meeting time known'),('Before departure','Documents downloaded offline')
  ) as v(c, i);
end
$seed$;
