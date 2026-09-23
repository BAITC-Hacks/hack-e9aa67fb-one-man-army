# Organizer questions — Halyk Career Quest (Case 1)

Ask in this order. Record the answer, who gave it, and the time. Then update `docs/requirements.md` §9.

1. **(AMB-01, most urgent)** "The Career Quest starter kit says the data may not be taken outside the hackathon. May we commit the starter kit files (employees.json, events.json, skills.json, activity_history.csv) into our team repository in the BAITC-Hacks GitHub organization, so the jury can launch the project from a clean clone?"
   - If NO: "Is it acceptable that the repo contains a synthetic generator in the same schema, and the jury places the official kit into a documented folder?"

2. **(AMB-02)** "At the defense, in what exact form will the jury upload the three test profiles? Only employees.json with the profiles, or also activity_history.csv rows? Same `{meta, employees: [...]}` wrapper as the starter kit? Could they include new events, skills or roles? Will you upload through our web interface, or put files into a folder / run a command?"

3. **(AMB-10)** "Will the jury run our project locally from the README, or should we also provide a hosted URL? If local, is Docker available on the jury machine?"

4. **(AMB-03)** "May the recommender suggest an event whose target_grades contains the employee's next grade but not their current grade, or must recommendations respect the event's target_grades strictly?"

5. **(AMB-07)** "For 'AI recommendation of the next step': is it acceptable that a deterministic multi-factor engine selects the candidate events and an LLM ranks and explains them, as long as the rationale uses three or more factors?"
