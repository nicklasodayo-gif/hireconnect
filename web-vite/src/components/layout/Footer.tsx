export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="brand">Hire<span>Connect</span></div>
          <p>Connect Talent With Opportunity — built for Kenya's growing workforce.</p>
        </div>
        <div><h4>For Job Seekers</h4><a href="#/jobs">Browse Jobs</a><a href="#/companies">Companies</a><a href="#/register">Create Profile</a></div>
        <div><h4>For Employers</h4><a href="#/register">Post a Job</a><a href="#/employer/jobs">Manage Jobs</a></div>
        <div><h4>Company</h4><a href="#/">About</a><a href="#/">Contact</a><a href="#/">Privacy</a></div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} HireConnect. All rights reserved.</div>
    </footer>
  );
}
